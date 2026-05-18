import type { FastifyInstance } from 'fastify';
import type { Prisma } from '@prisma/client';
import { writeAuditLog } from '../lib/auditLog.js';
import { activityToApi, listEnvelope } from '../lib/contentApi.js';
import {
  ACTIVITY_TYPES,
  isActivityType,
  parseBoolean,
  parsePagination,
  validateActivityPayload,
} from '../lib/contentTypes.js';
import { prisma } from '../lib/prisma.js';
import { requireCmsEditor } from '../plugins/auth.js';

const MODULE = 'MOD:cms';

function toBigIntOrNull(v: unknown): bigint | null {
  if (v === null || v === undefined || v === '') return null;
  try {
    return BigInt(String(v));
  } catch {
    return null;
  }
}

export async function registerActivityRoutes(app: FastifyInstance) {
  app.get(
    '/activities',
    { preHandler: requireCmsEditor },
    async (request, reply) => {
      const q = request.query as Record<string, unknown>;
      const { limit, offset } = parsePagination(q);
      const publishedOnly = parseBoolean(q.is_published);
      const where =
        publishedOnly === undefined ? {} : { isPublished: publishedOnly };
      const [rows, total] = await Promise.all([
        prisma.activity.findMany({
          where,
          orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
          take: limit,
          skip: offset,
        }),
        prisma.activity.count({ where }),
      ]);
      return reply.send(
        listEnvelope(rows.map(activityToApi), total, limit, offset),
      );
    },
  );

  app.get<{ Params: { id: string } }>(
    '/activities/:id',
    { preHandler: requireCmsEditor },
    async (request, reply) => {
      const row = await prisma.activity.findUnique({
        where: { id: request.params.id },
      });
      if (!row) return reply.code(404).send({ error: 'Atividade não encontrada.' });
      return reply.send(activityToApi(row));
    },
  );

  app.post(
    '/activities',
    { preHandler: requireCmsEditor },
    async (request, reply) => {
      const body = request.body as Record<string, unknown>;
      const validated = validateActivityPayload(body);
      if (!validated.ok) return reply.code(400).send({ error: validated.error });
      const { title, type, questions } = validated.value;
      const bookId = toBigIntOrNull(body.book_id ?? body.bookId);
      const row = await prisma.activity.create({
        data: {
          title,
          type,
          questions: questions as Prisma.InputJsonValue,
          description: body.description != null ? String(body.description) : null,
          icon: body.icon != null ? String(body.icon) : null,
          badgeReward:
            body.badge_reward != null || body.badgeReward != null
              ? String(body.badge_reward ?? body.badgeReward)
              : null,
          bookId,
          sortOrder: Number.isFinite(Number(body.sort_order))
            ? Math.trunc(Number(body.sort_order))
            : 0,
          isPublished: parseBoolean(body.is_published ?? body.isPublished) ?? false,
        },
      });
      await writeAuditLog({
        actorUserId: request.user?.id,
        actionCode: 'EVT:ACTIVITY_CREATE',
        module: MODULE,
        targetType: 'activity',
        targetId: row.id,
        bookId: row.bookId,
        request,
      });
      return reply.code(201).send(activityToApi(row));
    },
  );

  app.patch<{ Params: { id: string } }>(
    '/activities/:id',
    { preHandler: requireCmsEditor },
    async (request, reply) => {
      const body = request.body as Record<string, unknown>;
      const data: {
        title?: string;
        description?: string | null;
        icon?: string | null;
        type?: string;
        questions?: Prisma.InputJsonValue;
        badgeReward?: string | null;
        bookId?: bigint | null;
        sortOrder?: number;
        isPublished?: boolean;
      } = {};
      if (body.title !== undefined) data.title = String(body.title).trim();
      if (body.description !== undefined) {
        data.description = body.description ? String(body.description) : null;
      }
      if (body.icon !== undefined) data.icon = body.icon ? String(body.icon) : null;
      if (body.type !== undefined) {
        const type = String(body.type).trim();
        if (!isActivityType(type)) {
          return reply.code(400).send({ error: 'type inválido.' });
        }
        data.type = type;
      }
      if (body.questions !== undefined) {
        data.questions = (Array.isArray(body.questions) ? body.questions : []) as Prisma.InputJsonValue;
      }
      if (body.badge_reward !== undefined || body.badgeReward !== undefined) {
        const v = body.badge_reward ?? body.badgeReward;
        data.badgeReward = v ? String(v) : null;
      }
      if (body.book_id !== undefined || body.bookId !== undefined) {
        data.bookId = toBigIntOrNull(body.book_id ?? body.bookId);
      }
      if (body.sort_order !== undefined) {
        data.sortOrder = Math.trunc(Number(body.sort_order) || 0);
      }
      const pub = parseBoolean(body.is_published ?? body.isPublished);
      if (pub !== undefined) data.isPublished = pub;
      if (Object.keys(data).length === 0) {
        return reply.code(400).send({ error: 'Nada a atualizar.' });
      }
      const prev = await prisma.activity.findUnique({ where: { id: request.params.id } });
      if (!prev) return reply.code(404).send({ error: 'Atividade não encontrada.' });
      const row = await prisma.activity.update({
        where: { id: request.params.id },
        data,
      });
      const code =
        data.isPublished !== undefined && data.isPublished !== prev.isPublished
          ? 'EVT:ACTIVITY_PUBLISH'
          : 'EVT:ACTIVITY_UPDATE';
      await writeAuditLog({
        actorUserId: request.user?.id,
        actionCode: code,
        module: MODULE,
        targetType: 'activity',
        targetId: row.id,
        bookId: row.bookId,
        request,
      });
      return reply.send(activityToApi(row));
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/activities/:id',
    { preHandler: requireCmsEditor },
    async (request, reply) => {
      const id = request.params.id;
      const prev = await prisma.activity.findUnique({ where: { id } });
      if (!prev) return reply.code(404).send({ error: 'Atividade não encontrada.' });
      await prisma.activity.delete({ where: { id } });
      await writeAuditLog({
        actorUserId: request.user?.id,
        actionCode: 'EVT:ACTIVITY_DELETE',
        module: MODULE,
        targetType: 'activity',
        targetId: id,
        bookId: prev.bookId,
        request,
      });
      return reply.code(204).send();
    },
  );
}
