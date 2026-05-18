import { writeAuditLog } from '../lib/auditLog.js';
import { coloringPageToApi, listEnvelope } from '../lib/contentApi.js';
import { parseBoolean, parsePagination } from '../lib/contentTypes.js';
import { prisma } from '../lib/prisma.js';
import { requireCmsEditor } from '../plugins/auth.js';
const MODULE = 'MOD:cms';
export async function registerColoringPageRoutes(app) {
    app.get('/coloring-pages', { preHandler: requireCmsEditor }, async (request, reply) => {
        const q = request.query;
        const { limit, offset } = parsePagination(q);
        const publishedOnly = parseBoolean(q.is_published);
        const where = publishedOnly === undefined ? {} : { isPublished: publishedOnly };
        const [rows, total] = await Promise.all([
            prisma.coloringPage.findMany({
                where,
                orderBy: { updatedAt: 'desc' },
                take: limit,
                skip: offset,
            }),
            prisma.coloringPage.count({ where }),
        ]);
        return reply.send(listEnvelope(rows.map(coloringPageToApi), total, limit, offset));
    });
    app.get('/coloring-pages/:id', { preHandler: requireCmsEditor }, async (request, reply) => {
        const row = await prisma.coloringPage.findUnique({
            where: { id: request.params.id },
        });
        if (!row)
            return reply.code(404).send({ error: 'Pintura não encontrada.' });
        return reply.send(coloringPageToApi(row));
    });
    app.post('/coloring-pages', { preHandler: requireCmsEditor }, async (request, reply) => {
        const body = request.body;
        const title = String(body.title || '').trim();
        if (!title)
            return reply.code(400).send({ error: 'title é obrigatório.' });
        const row = await prisma.coloringPage.create({
            data: {
                title,
                imageUrl: body.image_url != null || body.imageUrl != null
                    ? String(body.image_url ?? body.imageUrl).trim() || null
                    : null,
                defaultId: body.default_id != null || body.defaultId != null
                    ? String(body.default_id ?? body.defaultId).trim() || null
                    : null,
                svgType: body.svg_type != null || body.svgType != null
                    ? String(body.svg_type ?? body.svgType).trim() || null
                    : null,
                isPublished: parseBoolean(body.is_published ?? body.isPublished) ?? false,
            },
        });
        await writeAuditLog({
            actorUserId: request.user?.id,
            actionCode: 'EVT:COLORING_CREATE',
            module: MODULE,
            targetType: 'coloring_page',
            targetId: row.id,
            request,
        });
        return reply.code(201).send(coloringPageToApi(row));
    });
    app.patch('/coloring-pages/:id', { preHandler: requireCmsEditor }, async (request, reply) => {
        const body = request.body;
        const data = {};
        if (body.title !== undefined)
            data.title = String(body.title).trim();
        if (body.image_url !== undefined || body.imageUrl !== undefined) {
            const v = body.image_url ?? body.imageUrl;
            data.imageUrl = v ? String(v).trim() : null;
        }
        if (body.default_id !== undefined || body.defaultId !== undefined) {
            const v = body.default_id ?? body.defaultId;
            data.defaultId = v ? String(v).trim() : null;
        }
        if (body.svg_type !== undefined || body.svgType !== undefined) {
            const v = body.svg_type ?? body.svgType;
            data.svgType = v ? String(v).trim() : null;
        }
        const pub = parseBoolean(body.is_published ?? body.isPublished);
        if (pub !== undefined)
            data.isPublished = pub;
        if (Object.keys(data).length === 0) {
            return reply.code(400).send({ error: 'Nada a atualizar.' });
        }
        const prev = await prisma.coloringPage.findUnique({ where: { id: request.params.id } });
        if (!prev)
            return reply.code(404).send({ error: 'Pintura não encontrada.' });
        const row = await prisma.coloringPage.update({
            where: { id: request.params.id },
            data,
        });
        const code = data.isPublished !== undefined && data.isPublished !== prev.isPublished
            ? 'EVT:COLORING_PUBLISH'
            : 'EVT:COLORING_UPDATE';
        await writeAuditLog({
            actorUserId: request.user?.id,
            actionCode: code,
            module: MODULE,
            targetType: 'coloring_page',
            targetId: row.id,
            metadata: data.isPublished !== undefined ? { is_published: row.isPublished } : null,
            request,
        });
        return reply.send(coloringPageToApi(row));
    });
    app.delete('/coloring-pages/:id', { preHandler: requireCmsEditor }, async (request, reply) => {
        const id = request.params.id;
        const prev = await prisma.coloringPage.findUnique({ where: { id } });
        if (!prev)
            return reply.code(404).send({ error: 'Pintura não encontrada.' });
        await prisma.coloringPage.delete({ where: { id } });
        await writeAuditLog({
            actorUserId: request.user?.id,
            actionCode: 'EVT:COLORING_DELETE',
            module: MODULE,
            targetType: 'coloring_page',
            targetId: id,
            request,
        });
        return reply.code(204).send();
    });
}
