import type { FastifyInstance } from 'fastify';
import { writeAuditLog } from '../lib/auditLog.js';
import { puzzleGameToApi, listEnvelope } from '../lib/contentApi.js';
import {
  parseBoolean,
  parsePagination,
  parsePuzzlePieceCount,
  validatePuzzlePayload,
} from '../lib/contentTypes.js';
import { prisma } from '../lib/prisma.js';
import { requireCmsEditor } from '../plugins/auth.js';

const MODULE = 'MOD:cms';

export async function registerPuzzleGameRoutes(app: FastifyInstance) {
  app.get(
    '/puzzle-games',
    { preHandler: requireCmsEditor },
    async (request, reply) => {
      const q = request.query as Record<string, unknown>;
      const { limit, offset } = parsePagination(q);
      const publishedOnly = parseBoolean(q.is_published);
      const where =
        publishedOnly === undefined ? {} : { isPublished: publishedOnly };
      const [rows, total] = await Promise.all([
        prisma.puzzleGame.findMany({
          where,
          orderBy: { updatedAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        prisma.puzzleGame.count({ where }),
      ]);
      return reply.send(
        listEnvelope(rows.map(puzzleGameToApi), total, limit, offset),
      );
    },
  );

  app.get<{ Params: { id: string } }>(
    '/puzzle-games/:id',
    { preHandler: requireCmsEditor },
    async (request, reply) => {
      const row = await prisma.puzzleGame.findUnique({
        where: { id: request.params.id },
      });
      if (!row) return reply.code(404).send({ error: 'Quebra-cabeça não encontrado.' });
      return reply.send(puzzleGameToApi(row));
    },
  );

  app.post(
    '/puzzle-games',
    { preHandler: requireCmsEditor },
    async (request, reply) => {
      const body = request.body as Record<string, unknown>;
      const validated = validatePuzzlePayload(body);
      if (!validated.ok) return reply.code(400).send({ error: validated.error });
      const { title, imageUrl, pieceCount } = validated.value;
      const row = await prisma.puzzleGame.create({
        data: {
          title,
          imageUrl,
          pieceCount,
          description: body.description != null ? String(body.description) : null,
          caption: body.caption != null ? String(body.caption) : null,
          isPublished: parseBoolean(body.is_published ?? body.isPublished) ?? false,
        },
      });
      await writeAuditLog({
        actorUserId: request.user?.id,
        actionCode: 'EVT:PUZZLE_CREATE',
        module: MODULE,
        targetType: 'puzzle_game',
        targetId: row.id,
        request,
      });
      return reply.code(201).send(puzzleGameToApi(row));
    },
  );

  app.patch<{ Params: { id: string } }>(
    '/puzzle-games/:id',
    { preHandler: requireCmsEditor },
    async (request, reply) => {
      const body = request.body as Record<string, unknown>;
      const data: {
        title?: string;
        description?: string | null;
        imageUrl?: string;
        pieceCount?: number;
        caption?: string | null;
        isPublished?: boolean;
      } = {};
      if (body.title !== undefined) data.title = String(body.title).trim();
      if (body.description !== undefined) {
        data.description = body.description ? String(body.description) : null;
      }
      if (body.image_url !== undefined || body.imageUrl !== undefined) {
        data.imageUrl = String(body.image_url ?? body.imageUrl).trim();
      }
      if (body.piece_count !== undefined || body.pieceCount !== undefined) {
        const pc = parsePuzzlePieceCount(body.piece_count ?? body.pieceCount);
        if (pc == null) {
          return reply.code(400).send({ error: 'piece_count inválido (15|30|60|120|240).' });
        }
        data.pieceCount = pc;
      }
      if (body.caption !== undefined) data.caption = body.caption ? String(body.caption) : null;
      const pub = parseBoolean(body.is_published ?? body.isPublished);
      if (pub !== undefined) data.isPublished = pub;
      if (Object.keys(data).length === 0) {
        return reply.code(400).send({ error: 'Nada a atualizar.' });
      }
      const prev = await prisma.puzzleGame.findUnique({ where: { id: request.params.id } });
      if (!prev) return reply.code(404).send({ error: 'Quebra-cabeça não encontrado.' });
      const row = await prisma.puzzleGame.update({
        where: { id: request.params.id },
        data,
      });
      const code =
        data.isPublished !== undefined && data.isPublished !== prev.isPublished
          ? 'EVT:PUZZLE_PUBLISH'
          : 'EVT:PUZZLE_UPDATE';
      await writeAuditLog({
        actorUserId: request.user?.id,
        actionCode: code,
        module: MODULE,
        targetType: 'puzzle_game',
        targetId: row.id,
        metadata: data.isPublished !== undefined ? { is_published: row.isPublished } : null,
        request,
      });
      return reply.send(puzzleGameToApi(row));
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/puzzle-games/:id',
    { preHandler: requireCmsEditor },
    async (request, reply) => {
      const id = request.params.id;
      const prev = await prisma.puzzleGame.findUnique({ where: { id } });
      if (!prev) return reply.code(404).send({ error: 'Quebra-cabeça não encontrado.' });
      await prisma.puzzleGame.delete({ where: { id } });
      await writeAuditLog({
        actorUserId: request.user?.id,
        actionCode: 'EVT:PUZZLE_DELETE',
        module: MODULE,
        targetType: 'puzzle_game',
        targetId: id,
        request,
      });
      return reply.code(204).send();
    },
  );
}
