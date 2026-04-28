import { createHash, randomBytes } from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import type { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';

export function hashPasswordResetToken(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex');
}

export function generatePasswordResetRawToken(): string {
  return randomBytes(32).toString('hex');
}

export function clientIp(request: FastifyRequest | null | undefined): string | null {
  if (!request) return null;
  const xf = request.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length > 0) {
    return xf.split(',')[0].trim();
  }
  return request.ip || null;
}

export type WriteAuditInput = {
  actorUserId?: string | null;
  actionCode: string;
  module: string;
  targetType?: string | null;
  targetId?: string | null;
  bookId?: bigint | null;
  pageRef?: string | null;
  metadata?: Record<string, unknown> | null;
  request?: FastifyRequest | null;
};

/** Persiste evento de auditoria; falhas não interrompem o fluxo principal. */
export async function writeAuditLog(input: WriteAuditInput): Promise<void> {
  try {
    const ua = input.request?.headers['user-agent'];
    await prisma.adminAuditLog.create({
      data: {
        actorUserId: input.actorUserId ?? null,
        actionCode: input.actionCode,
        module: input.module,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        bookId: input.bookId ?? null,
        pageRef: input.pageRef ?? null,
        metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        ip: clientIp(input.request ?? null),
        userAgent: typeof ua === 'string' ? ua.slice(0, 500) : null,
      },
    });
  } catch (err) {
    console.error('[audit] writeAuditLog failed', err);
  }
}
