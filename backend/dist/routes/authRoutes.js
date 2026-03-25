import { prisma } from '../lib/prisma.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { signAccessToken } from '../lib/jwt.js';
import { requireAuth } from '../plugins/auth.js';
export async function registerAuthRoutes(app) {
    app.post('/auth/register', async (request, reply) => {
        if (process.env.ENABLE_PUBLIC_REGISTER !== 'true') {
            return reply
                .code(403)
                .send({ error: 'Registo público desativado. Use ENABLE_PUBLIC_REGISTER=true ou crie utilizador com o script.' });
        }
        const body = request.body;
        const email = String(body?.email || '').trim().toLowerCase();
        const password = String(body?.password || '');
        const name = body?.name?.trim() || null;
        if (!email || !password) {
            return reply.code(400).send({ error: 'Email e senha obrigatórios.' });
        }
        const exists = await prisma.user.findUnique({ where: { email } });
        if (exists) {
            return reply.code(409).send({ error: 'Email já registado.' });
        }
        const passwordHash = await hashPassword(password);
        const user = await prisma.user.create({
            data: {
                email,
                passwordHash,
                name,
            },
        });
        await prisma.profile.create({ data: { userId: user.id } });
        const token = signAccessToken({
            sub: user.id,
            email: user.email,
            role: user.role,
        });
        return reply.send({
            access_token: token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                avatar_url: null,
            },
        });
    });
    app.post('/auth/login', async (request, reply) => {
        const body = request.body;
        const email = String(body?.email || '').trim().toLowerCase();
        const password = String(body?.password || '');
        if (!email || !password) {
            return reply.code(400).send({ error: 'Email e senha obrigatórios.' });
        }
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !(await verifyPassword(password, user.passwordHash))) {
            return reply.code(401).send({ error: 'Credenciais inválidas.' });
        }
        const full = await prisma.user.findUnique({
            where: { id: user.id },
            include: { profile: true },
        });
        const token = signAccessToken({
            sub: user.id,
            email: user.email,
            role: user.role,
        });
        return reply.send({
            access_token: token,
            user: {
                id: user.id,
                email: user.email,
                name: full?.name ?? user.name,
                role: user.role,
                avatar_url: full?.profile?.icone ?? null,
            },
        });
    });
    app.get('/auth/me', { preHandler: requireAuth }, async (request, reply) => {
        const row = await prisma.user.findUnique({
            where: { id: request.user.id },
            include: { profile: true },
        });
        if (!row)
            return reply.code(404).send({ error: 'Utilizador não encontrado.' });
        return reply.send({
            user: {
                id: row.id,
                email: row.email,
                name: row.name,
                role: row.role,
                createdAt: row.createdAt,
                avatar_url: row.profile?.icone ?? null,
            },
        });
    });
    app.patch('/auth/profile', { preHandler: requireAuth }, async (request, reply) => {
        const body = request.body;
        const id = request.user.id;
        if (body.name !== undefined) {
            await prisma.user.update({
                where: { id },
                data: { name: body.name?.trim() || null },
            });
        }
        if (body.avatar_url !== undefined) {
            await prisma.profile.upsert({
                where: { userId: id },
                create: { userId: id, icone: body.avatar_url },
                update: { icone: body.avatar_url },
            });
        }
        return reply.send({ ok: true });
    });
    app.post('/auth/change-password', { preHandler: requireAuth }, async (request, reply) => {
        const body = request.body;
        const current = String(body?.currentPassword || '');
        const next = String(body?.newPassword || '');
        if (!current || !next) {
            return reply.code(400).send({ error: 'Senha atual e nova senha são obrigatórias.' });
        }
        if (next.length < 6) {
            return reply.code(400).send({ error: 'A nova senha deve ter pelo menos 6 caracteres.' });
        }
        const user = await prisma.user.findUnique({ where: { id: request.user.id } });
        if (!user || !(await verifyPassword(current, user.passwordHash))) {
            return reply.code(400).send({ error: 'Senha atual incorreta.' });
        }
        await prisma.user.update({
            where: { id: request.user.id },
            data: { passwordHash: await hashPassword(next) },
        });
        return reply.send({ ok: true });
    });
}
