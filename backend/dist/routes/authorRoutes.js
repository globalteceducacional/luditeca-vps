import { prisma } from '../lib/prisma.js';
import { jsonSafe } from '../lib/serialize.js';
import { requireAuth } from '../plugins/auth.js';
export async function registerAuthorRoutes(app) {
    app.get('/authors', { preHandler: requireAuth }, async (_request, reply) => {
        const rows = await prisma.author.findMany({ orderBy: { name: 'asc' } });
        return reply.send(jsonSafe(rows));
    });
    app.get('/authors/:id', { preHandler: requireAuth }, async (request, reply) => {
        const id = BigInt(request.params.id);
        const row = await prisma.author.findUnique({ where: { id } });
        if (!row)
            return reply.code(404).send({ error: 'Autor não encontrado.' });
        return reply.send(jsonSafe(row));
    });
    app.post('/authors', { preHandler: requireAuth }, async (request, reply) => {
        const body = request.body;
        const row = await prisma.author.create({
            data: {
                name: String(body.name || ''),
                bio: body.bio != null ? String(body.bio) : null,
                photoUrl: body.photo_url != null ? String(body.photo_url) : null,
            },
        });
        return reply.code(201).send(jsonSafe(row));
    });
    app.patch('/authors/:id', { preHandler: requireAuth }, async (request, reply) => {
        const id = BigInt(request.params.id);
        const body = request.body;
        const data = {};
        if (body.name !== undefined)
            data.name = String(body.name);
        if (body.bio !== undefined)
            data.bio = body.bio ? String(body.bio) : null;
        if (body.photo_url !== undefined) {
            data.photoUrl = body.photo_url ? String(body.photo_url) : null;
        }
        if (Object.keys(data).length === 0) {
            return reply.code(400).send({ error: 'Nada a atualizar.' });
        }
        const row = await prisma.author.update({
            where: { id },
            data,
        });
        return reply.send(jsonSafe(row));
    });
    app.delete('/authors/:id', { preHandler: requireAuth }, async (request, reply) => {
        const id = BigInt(request.params.id);
        await prisma.author.delete({ where: { id } });
        return reply.code(204).send();
    });
}
