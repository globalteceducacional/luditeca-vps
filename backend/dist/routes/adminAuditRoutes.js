import { prisma } from '../lib/prisma.js';
import { jsonSafe } from '../lib/serialize.js';
import { requireAdmin } from '../plugins/auth.js';
const CSV_MAX_ROWS = 5000;
function escapeCsvCell(value) {
    const s = value == null ? '' : String(value);
    if (/[",\n\r]/.test(s))
        return `"${s.replace(/"/g, '""')}"`;
    return s;
}
function buildAuditWhere(q) {
    const where = {};
    if (q.book_id && /^\d+$/.test(q.book_id)) {
        where.bookId = BigInt(q.book_id);
    }
    if (q.actor_user_id?.trim()) {
        where.actorUserId = q.actor_user_id.trim();
    }
    if (q.action_code?.trim()) {
        where.actionCode = { contains: q.action_code.trim(), mode: 'insensitive' };
    }
    return where;
}
export async function registerAdminAuditRoutes(app) {
    app.get('/admin/audit-logs', { preHandler: requireAdmin }, async (request, reply) => {
        const q = request.query;
        const take = Math.min(100, Math.max(1, parseInt(String(q.limit || '50'), 10) || 50));
        const skip = Math.max(0, parseInt(String(q.offset || '0'), 10) || 0);
        const where = buildAuditWhere(q);
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
    });
    app.get('/admin/audit-logs/export.csv', { preHandler: requireAdmin }, async (request, reply) => {
        const q = request.query;
        const where = buildAuditWhere(q);
        const rows = await prisma.adminAuditLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: CSV_MAX_ROWS,
        });
        const header = [
            'id',
            'createdAt',
            'actionCode',
            'actorUserId',
            'targetType',
            'targetId',
            'bookId',
            'pageRef',
            'metadata',
        ];
        const lines = [
            header.join(','),
            ...rows.map((r) => [
                r.id,
                r.createdAt?.toISOString() ?? '',
                r.actionCode,
                r.actorUserId ?? '',
                r.targetType ?? '',
                r.targetId ?? '',
                r.bookId != null ? String(r.bookId) : '',
                r.pageRef ?? '',
                r.metadata != null ? JSON.stringify(r.metadata) : '',
            ]
                .map(escapeCsvCell)
                .join(',')),
        ];
        const csv = `\uFEFF${lines.join('\r\n')}`;
        return reply
            .header('Content-Type', 'text/csv; charset=utf-8')
            .header('Content-Disposition', 'attachment; filename="audit-logs.csv"')
            .send(csv);
    });
}
