import { prisma } from '../lib/prisma.js';
import { hashPassword } from '../lib/password.js';
import { requireAdmin } from '../plugins/auth.js';
import { USER_ROLES } from '../lib/roles.js';
import { jsonSafe } from '../lib/serialize.js';
function normalizeEmail(v) {
    return String(v ?? '').trim().toLowerCase();
}
function assertRole(v) {
    const r = String(v ?? '').trim();
    if (!USER_ROLES.includes(r))
        throw new Error('Role inválido.');
    return r;
}
function userPublic(u) {
    return {
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        createdAt: u.createdAt,
    };
}
export async function registerUserRoutes(app) {
    // Lista usuários (somente ADM)
    app.get('/users', { preHandler: requireAdmin }, async (_request, reply) => {
        const rows = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
        return reply.send(jsonSafe(rows.map((u) => userPublic(u))));
    });
    // Cria usuário (somente ADM)
    app.post('/users', { preHandler: requireAdmin }, async (request, reply) => {
        const body = request.body;
        const email = normalizeEmail(body?.email);
        const password = String(body?.password ?? '');
        const name = body?.name != null ? String(body.name).trim() : null;
        let role;
        try {
            role = assertRole(body?.role ?? 'aluno');
        }
        catch (e) {
            return reply.code(400).send({ error: e.message });
        }
        if (!email || !password)
            return reply.code(400).send({ error: 'Email e senha obrigatórios.' });
        if (password.length < 6)
            return reply.code(400).send({ error: 'A senha deve ter pelo menos 6 caracteres.' });
        const exists = await prisma.user.findUnique({ where: { email } });
        if (exists)
            return reply.code(409).send({ error: 'Email já existe.' });
        const user = await prisma.user.create({
            data: {
                email,
                passwordHash: await hashPassword(password),
                name,
                role,
                profile: { create: { role } },
            },
        });
        return reply.code(201).send(userPublic(user));
    });
    // Atualiza usuário (somente ADM)
    app.patch('/users/:id', { preHandler: requireAdmin }, async (request, reply) => {
        const id = String(request.params.id || '');
        const body = request.body;
        const data = {};
        if (body?.name !== undefined)
            data.name = body.name ? String(body.name).trim() : null;
        if (body?.role !== undefined) {
            try {
                data.role = assertRole(body.role);
            }
            catch (e) {
                return reply.code(400).send({ error: e.message });
            }
        }
        if (body?.password !== undefined) {
            const password = String(body.password ?? '');
            if (!password || password.length < 6) {
                return reply.code(400).send({ error: 'A senha deve ter pelo menos 6 caracteres.' });
            }
            data.passwordHash = await hashPassword(password);
        }
        if (Object.keys(data).length === 0)
            return reply.code(400).send({ error: 'Nada a atualizar.' });
        const updated = await prisma.user.update({ where: { id }, data });
        if (data.role) {
            await prisma.profile.upsert({
                where: { userId: id },
                create: { userId: id, role: data.role },
                update: { role: data.role },
            });
        }
        return reply.send(userPublic(updated));
    });
    // Exclui usuário (somente ADM)
    app.delete('/users/:id', { preHandler: requireAdmin }, async (request, reply) => {
        const id = String(request.params.id || '');
        const currentUserId = request.user?.id;
        if (currentUserId && id === currentUserId) {
            return reply.code(400).send({ error: 'Você não pode excluir a própria conta.' });
        }
        await prisma.user.delete({ where: { id } });
        return reply.code(204).send();
    });
}
