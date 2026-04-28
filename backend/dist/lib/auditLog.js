import { createHash, randomBytes } from 'node:crypto';
import { prisma } from './prisma.js';
export function hashPasswordResetToken(raw) {
    return createHash('sha256').update(raw, 'utf8').digest('hex');
}
export function generatePasswordResetRawToken() {
    return randomBytes(32).toString('hex');
}
export function clientIp(request) {
    if (!request)
        return null;
    const xf = request.headers['x-forwarded-for'];
    if (typeof xf === 'string' && xf.length > 0) {
        return xf.split(',')[0].trim();
    }
    return request.ip || null;
}
/** Persiste evento de auditoria; falhas não interrompem o fluxo principal. */
export async function writeAuditLog(input) {
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
                metadata: (input.metadata ?? undefined),
                ip: clientIp(input.request ?? null),
                userAgent: typeof ua === 'string' ? ua.slice(0, 500) : null,
            },
        });
    }
    catch (err) {
        console.error('[audit] writeAuditLog failed', err);
    }
}
