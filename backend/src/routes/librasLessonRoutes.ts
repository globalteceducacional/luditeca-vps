import type { FastifyInstance } from 'fastify';
import type { Prisma } from '@prisma/client';
import { writeAuditLog } from '../lib/auditLog.js';
import { librasLessonToApi, listEnvelope } from '../lib/contentApi.js';
import { parsePagination } from '../lib/contentTypes.js';
import { prisma } from '../lib/prisma.js';
import { requireCmsEditor } from '../plugins/auth.js';

const MODULE = 'MOD:cms';

export async function registerLibrasLessonRoutes(app: FastifyInstance) {
  app.get(
    '/libras-lessons',
    { preHandler: requireCmsEditor },
    async (request, reply) => {
      const q = request.query as Record<string, unknown>;
      const { limit, offset } = parsePagination(q);
      const [rows, total] = await Promise.all([
        prisma.librasLesson.findMany({
          orderBy: { sortOrder: 'asc' },
          take: limit,
          skip: offset,
        }),
        prisma.librasLesson.count(),
      ]);
      return reply.send(
        listEnvelope(rows.map(librasLessonToApi), total, limit, offset),
      );
    },
  );

  app.patch(
    '/libras-lessons/reorder',
    { preHandler: requireCmsEditor },
    async (request, reply) => {
      const body = request.body as { ids?: unknown };
      if (!Array.isArray(body.ids) || body.ids.length === 0) {
        return reply.code(400).send({ error: 'ids (array) é obrigatório.' });
      }
      const ids = body.ids.map((id) => String(id));
      await prisma.$transaction(
        ids.map((id, index) =>
          prisma.librasLesson.update({
            where: { id },
            data: { sortOrder: index },
          }),
        ),
      );
      await writeAuditLog({
        actorUserId: request.user?.id,
        actionCode: 'EVT:LIBRAS_REORDER',
        module: MODULE,
        targetType: 'libras_lesson',
        metadata: { count: ids.length },
        request,
      });
      return reply.send({ ok: true });
    },
  );

  app.get<{ Params: { id: string } }>(
    '/libras-lessons/:id',
    { preHandler: requireCmsEditor },
    async (request, reply) => {
      const row = await prisma.librasLesson.findUnique({
        where: { id: request.params.id },
      });
      if (!row) return reply.code(404).send({ error: 'Lição LIBRAS não encontrada.' });
      return reply.send(librasLessonToApi(row));
    },
  );

  app.post(
    '/libras-lessons',
    { preHandler: requireCmsEditor },
    async (request, reply) => {
      const body = request.body as Record<string, unknown>;
      const word = String(body.word || '').trim();
      if (!word) return reply.code(400).send({ error: 'word é obrigatório.' });
      const row = await prisma.librasLesson.create({
        data: {
          word,
          category: body.category != null ? String(body.category) : null,
          imageUrl:
            body.image_url != null || body.imageUrl != null
              ? String(body.image_url ?? body.imageUrl).trim() || null
              : null,
          description: body.description != null ? String(body.description) : null,
          quizQuestion:
            body.quiz_question != null || body.quizQuestion != null
              ? String(body.quiz_question ?? body.quizQuestion)
              : null,
          quizOptions: Array.isArray(body.quiz_options ?? body.quizOptions)
            ? ((body.quiz_options ?? body.quizOptions) as Prisma.InputJsonValue)
            : undefined,
          quizCorrect:
            body.quiz_correct != null || body.quizCorrect != null
              ? Math.trunc(Number(body.quiz_correct ?? body.quizCorrect))
              : null,
          sortOrder: Number.isFinite(Number(body.sort_order))
            ? Math.trunc(Number(body.sort_order))
            : 0,
        },
      });
      await writeAuditLog({
        actorUserId: request.user?.id,
        actionCode: 'EVT:LIBRAS_CREATE',
        module: MODULE,
        targetType: 'libras_lesson',
        targetId: row.id,
        request,
      });
      return reply.code(201).send(librasLessonToApi(row));
    },
  );

  app.patch<{ Params: { id: string } }>(
    '/libras-lessons/:id',
    { preHandler: requireCmsEditor },
    async (request, reply) => {
      const body = request.body as Record<string, unknown>;
      const data: Prisma.LibrasLessonUpdateInput = {};
      if (body.word !== undefined) data.word = String(body.word).trim();
      if (body.category !== undefined) data.category = body.category ? String(body.category) : null;
      if (body.image_url !== undefined || body.imageUrl !== undefined) {
        const v = body.image_url ?? body.imageUrl;
        data.imageUrl = v ? String(v).trim() : null;
      }
      if (body.description !== undefined) {
        data.description = body.description ? String(body.description) : null;
      }
      if (body.quiz_question !== undefined || body.quizQuestion !== undefined) {
        const v = body.quiz_question ?? body.quizQuestion;
        data.quizQuestion = v ? String(v) : null;
      }
      if (body.quiz_options !== undefined || body.quizOptions !== undefined) {
        const arr = body.quiz_options ?? body.quizOptions;
        data.quizOptions = Array.isArray(arr) ? (arr as Prisma.InputJsonValue) : undefined;
      }
      if (body.quiz_correct !== undefined || body.quizCorrect !== undefined) {
        const v = body.quiz_correct ?? body.quizCorrect;
        data.quizCorrect = v === null || v === '' ? null : Math.trunc(Number(v));
      }
      if (body.sort_order !== undefined) {
        data.sortOrder = Math.trunc(Number(body.sort_order) || 0);
      }
      if (Object.keys(data).length === 0) {
        return reply.code(400).send({ error: 'Nada a atualizar.' });
      }
      const prev = await prisma.librasLesson.findUnique({ where: { id: request.params.id } });
      if (!prev) return reply.code(404).send({ error: 'Lição LIBRAS não encontrada.' });
      const row = await prisma.librasLesson.update({
        where: { id: request.params.id },
        data,
      });
      await writeAuditLog({
        actorUserId: request.user?.id,
        actionCode: 'EVT:LIBRAS_UPDATE',
        module: MODULE,
        targetType: 'libras_lesson',
        targetId: row.id,
        request,
      });
      return reply.send(librasLessonToApi(row));
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/libras-lessons/:id',
    { preHandler: requireCmsEditor },
    async (request, reply) => {
      const id = request.params.id;
      const prev = await prisma.librasLesson.findUnique({ where: { id } });
      if (!prev) return reply.code(404).send({ error: 'Lição LIBRAS não encontrada.' });
      await prisma.librasLesson.delete({ where: { id } });
      await writeAuditLog({
        actorUserId: request.user?.id,
        actionCode: 'EVT:LIBRAS_DELETE',
        module: MODULE,
        targetType: 'libras_lesson',
        targetId: id,
        request,
      });
      return reply.code(204).send();
    },
  );

}
