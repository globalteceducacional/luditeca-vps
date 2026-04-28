import type { FastifyInstance } from 'fastify';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { jsonSafe } from '../lib/serialize.js';
import { writeTechnicalLog } from '../lib/technicalLog.js';
import { requireAdmin, requireAuth } from '../plugins/auth.js';

export async function registerTelemetryRoutes(app: FastifyInstance) {
  app.post(
    '/telemetry/client',
    { preHandler: requireAuth },
    async (request, reply) => {
      const body = request.body as Record<string, unknown>;
      const category = String(body.category || 'general')
        .replace(/[^\w.-]/g, '_')
        .slice(0, 64);
      const message = String(body.message || 'client event').slice(0, 500);
      const meta =
        body.meta && typeof body.meta === 'object' && !Array.isArray(body.meta)
          ? (body.meta as Record<string, unknown>)
          : {};

      await writeTechnicalLog({
        level: 'warn',
        category: `client:${category}`,
        message,
        metadata: {
          ...meta,
          ...(body.bookId != null ? { bookId: body.bookId } : {}),
        },
        requestId: request.luditecaRequestId,
        route: 'client',
        method: 'POST',
        statusCode: null,
        durationMs: null,
        userId: request.user?.id ?? null,
        request,
      });

      return reply.send({ ok: true });
    },
  );

  app.get(
    '/admin/technical-logs',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const q = request.query as Record<string, string | undefined>;
      const take = Math.min(100, Math.max(1, parseInt(String(q.limit || '50'), 10) || 50));
      const skip = Math.max(0, parseInt(String(q.offset || '0'), 10) || 0);
      const where: Prisma.TechnicalLogWhereInput = {};
      if (q.level?.trim()) {
        where.level = q.level.trim();
      }
      if (q.category?.trim()) {
        where.category = { contains: q.category.trim(), mode: 'insensitive' };
      }
      if (q.user_id?.trim()) {
        where.userId = q.user_id.trim();
      }

      const [rows, total] = await Promise.all([
        prisma.technicalLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take,
          skip,
        }),
        prisma.technicalLog.count({ where }),
      ]);

      return reply.send(jsonSafe({ data: rows, total, take, skip }));
    },
  );
}
