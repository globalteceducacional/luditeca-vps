import type { FastifyRequest } from 'fastify';
import type { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';
import { clientIp } from './auditLog.js';

export type WriteTechnicalLogInput = {
  level: 'error' | 'warn' | 'info';
  category: string;
  message: string;
  metadata?: Record<string, unknown> | null;
  requestId?: string | null;
  route?: string | null;
  method?: string | null;
  statusCode?: number | null;
  durationMs?: number | null;
  userId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  request?: FastifyRequest | null;
};

function truncate(s: string, max: number): string {
  const t = String(s || '').trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

/** Persiste evento técnico; nunca lança para não afectar pedidos. */
export async function writeTechnicalLog(input: WriteTechnicalLogInput): Promise<void> {
  try {
    const ua =
      input.userAgent ??
      (typeof input.request?.headers['user-agent'] === 'string'
        ? input.request.headers['user-agent'].slice(0, 500)
        : null);
    await prisma.technicalLog.create({
      data: {
        level: truncate(input.level, 16),
        category: truncate(input.category, 64),
        message: truncate(input.message, 500),
        metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        requestId: input.requestId != null ? truncate(String(input.requestId), 64) : null,
        route: input.route != null ? truncate(String(input.route), 512) : null,
        method: input.method != null ? truncate(String(input.method), 16) : null,
        statusCode: input.statusCode ?? null,
        durationMs: input.durationMs ?? null,
        userId: input.userId ?? input.request?.user?.id ?? null,
        ip: input.ip ?? clientIp(input.request ?? null),
        userAgent: ua,
      },
    });
  } catch (err) {
    console.error('[technical-log] writeTechnicalLog failed', err);
  }
}
