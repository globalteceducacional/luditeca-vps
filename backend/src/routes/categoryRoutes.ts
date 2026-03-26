import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { jsonSafe } from '../lib/serialize.js';
import { requireAdmin } from '../plugins/auth.js';
import { requireCmsEditor } from '../plugins/auth.js';
import { requireAuth } from '../plugins/auth.js';

export async function registerCategoryRoutes(app: FastifyInstance) {
  // Leitura (necessário no fluxo de criar/editar livros): admin + editor
  app.get('/categories', { preHandler: requireAuth }, async (_request, reply) => {
    const rows = await prisma.category.findMany({ orderBy: { name: 'asc' } });
    return reply.send(jsonSafe(rows));
  });

  app.get<{ Params: { id: string } }>(
    '/categories/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      const id = BigInt(request.params.id);
      const row = await prisma.category.findUnique({ where: { id } });
      if (!row) return reply.code(404).send({ error: 'Categoria não encontrada.' });
      return reply.send(jsonSafe(row));
    },
  );

  // Escrita: somente ADM
  app.post('/categories', { preHandler: requireAdmin }, async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const row = await prisma.category.create({
      data: {
        name: String(body.name || ''),
        imageUrl: body.image_url != null ? String(body.image_url) : null,
      },
    });
    return reply.code(201).send(jsonSafe(row));
  });

  app.patch<{ Params: { id: string } }>(
    '/categories/:id',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const id = BigInt(request.params.id);
      const body = request.body as Record<string, unknown>;
      const data: { name?: string; imageUrl?: string | null } = {};
      if (body.name !== undefined) data.name = String(body.name);
      if (body.image_url !== undefined) {
        data.imageUrl = body.image_url ? String(body.image_url) : null;
      }
      if (Object.keys(data).length === 0) {
        return reply.code(400).send({ error: 'Nada a atualizar.' });
      }
      const row = await prisma.category.update({
        where: { id },
        data,
      });
      return reply.send(jsonSafe(row));
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/categories/:id',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const id = BigInt(request.params.id);
      await prisma.category.delete({ where: { id } });
      return reply.code(204).send();
    },
  );
}
