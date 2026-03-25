import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { jsonSafe } from '../lib/serialize.js';
import { requireAdmin } from '../plugins/auth.js';
import { requireCmsEditor } from '../plugins/auth.js';

export async function registerAuthorRoutes(app: FastifyInstance) {
  // Leitura (necessário no fluxo de criar/editar livros): admin + editor
  app.get('/authors', { preHandler: requireCmsEditor }, async (_request, reply) => {
    const rows = await prisma.author.findMany({ orderBy: { name: 'asc' } });
    return reply.send(jsonSafe(rows));
  });

  app.get<{ Params: { id: string } }>(
    '/authors/:id',
    { preHandler: requireCmsEditor },
    async (request, reply) => {
      const id = BigInt(request.params.id);
      const row = await prisma.author.findUnique({ where: { id } });
      if (!row) return reply.code(404).send({ error: 'Autor não encontrado.' });
      return reply.send(jsonSafe(row));
    },
  );

  // Escrita: somente ADM
  app.post('/authors', { preHandler: requireAdmin }, async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const row = await prisma.author.create({
      data: {
        name: String(body.name || ''),
        bio: body.bio != null ? String(body.bio) : null,
        photoUrl: body.photo_url != null ? String(body.photo_url) : null,
      },
    });
    return reply.code(201).send(jsonSafe(row));
  });

  app.patch<{ Params: { id: string } }>(
    '/authors/:id',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const id = BigInt(request.params.id);
      const body = request.body as Record<string, unknown>;
      const data: {
        name?: string;
        bio?: string | null;
        photoUrl?: string | null;
      } = {};
      if (body.name !== undefined) data.name = String(body.name);
      if (body.bio !== undefined) data.bio = body.bio ? String(body.bio) : null;
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
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/authors/:id',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const id = BigInt(request.params.id);
      await prisma.author.delete({ where: { id } });
      return reply.code(204).send();
    },
  );
}
