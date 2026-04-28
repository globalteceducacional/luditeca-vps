import type { FastifyInstance } from 'fastify';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { jsonSafe } from '../lib/serialize.js';
import { requireAdmin } from '../plugins/auth.js';

export async function registerAdminAuditRoutes(app: FastifyInstance) {
  app.get(
    '/admin/audit-logs',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const q = request.query as Record<string, string | undefined>;
      const take = Math.min(100, Math.max(1, parseInt(String(q.limit || '50'), 10) || 50));
      const skip = Math.max(0, parseInt(String(q.offset || '0'), 10) || 0);

      const where: Prisma.AdminAuditLogWhereInput = {};

      if (q.book_id && /^\d+$/.test(q.book_id)) {
        where.bookId = BigInt(q.book_id);
      }
      if (q.actor_user_id?.trim()) {
        where.actorUserId = q.actor_user_id.trim();
      }
      if (q.action_code?.trim()) {
        where.actionCode = { contains: q.action_code.trim(), mode: 'insensitive' };
      }

      const [rows, total] = await Promise.all([
        prisma.adminAuditLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take,
          skip,
        }),
        prisma.adminAuditLog.count({ where }),
      ]);

      return reply.send(jsonSafe({ data: rows, total, take, skip }));
    },
  );
}
