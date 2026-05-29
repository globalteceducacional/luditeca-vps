import { BookWorkflowStatus } from '@prisma/client';
import { activityToApi, coloringPageToApi, librasLessonToApi, listEnvelope, puzzleGameToApi, } from '../lib/contentApi.js';
import { parsePagination } from '../lib/contentTypes.js';
import { hydrateBookAssetUrls, hydrateLegacyPagesMediaUrls, hydratePagesV2MediaUrls, parseBookDetailView, } from '../lib/bookMediaHydrate.js';
import { BOOK_CARD_SELECT, bookCardResponse, bookResponse, parseLimitOffset, } from '../lib/bookSerialize.js';
import { isPagesV2, migratePagesLegacyToV2 } from '../lib/pagesV2/migrate.js';
import { prisma } from '../lib/prisma.js';
import { requireAppUser } from '../plugins/auth.js';
async function buildPublishedBookDetail(bookId, viewRaw) {
    const b = await prisma.book.findUnique({
        where: { id: bookId },
        include: { authorRel: true, categoryRel: true },
    });
    if (!b || b.workflowStatus !== BookWorkflowStatus.published) {
        return { status: 404 };
    }
    const view = parseBookDetailView(viewRaw);
    const resp = bookResponse(b);
    const mediaUrlCache = new Map();
    const pagesV2Raw = (resp.pagesV2 ?? resp.pages_v2);
    const hasV2 = isPagesV2(pagesV2Raw);
    const hydrateV2 = (view === 'v2' || view === 'both') && hasV2;
    const hydrateLegacy = view === 'legacy' || view === 'both' || (view === 'v2' && !hasV2);
    const [hydratedV2, hydratedLegacy] = await Promise.all([
        hydrateV2
            ? hydratePagesV2MediaUrls(pagesV2Raw, mediaUrlCache)
            : Promise.resolve(pagesV2Raw),
        hydrateLegacy
            ? hydrateLegacyPagesMediaUrls(resp.pages, mediaUrlCache)
            : Promise.resolve(resp.pages),
    ]);
    delete resp.pagesV2;
    resp.pages_v2 = hydratedV2;
    resp.pages = hydratedLegacy;
    if (view === 'v2' && hasV2) {
        delete resp.pages;
    }
    const pagesLegacy = resp.pages;
    if (!hasV2 && Array.isArray(pagesLegacy) && pagesLegacy.length > 0) {
        resp.needsMigration = true;
        resp.pages_v2_suggested = migratePagesLegacyToV2(pagesLegacy);
    }
    await hydrateBookAssetUrls(resp, mediaUrlCache);
    return { status: 200, body: resp };
}
export async function registerAppRoutes(app) {
    app.get('/app/books', { preHandler: requireAppUser }, async (request, reply) => {
        const { limit, skip } = parseLimitOffset(request.query);
        const where = { workflowStatus: BookWorkflowStatus.published };
        const [rows, total] = await Promise.all([
            prisma.book.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip,
                select: BOOK_CARD_SELECT,
            }),
            prisma.book.count({ where }),
        ]);
        const mediaUrlCache = new Map();
        const items = await Promise.all(rows.map(async (r) => {
            const card = bookCardResponse(r);
            await hydrateBookAssetUrls(card, mediaUrlCache);
            return card;
        }));
        return reply.send(listEnvelope(items, total, limit, skip));
    });
    app.get('/app/books/:id', { preHandler: requireAppUser }, async (request, reply) => {
        let id;
        try {
            id = BigInt(request.params.id);
        }
        catch {
            return reply.code(400).send({ error: 'ID inválido.' });
        }
        const result = await buildPublishedBookDetail(id, request.query.view);
        if (result.status === 404) {
            return reply.code(404).send({ error: 'Livro não encontrado.' });
        }
        return reply.send(result.body);
    });
    app.get('/app/activities', { preHandler: requireAppUser }, async (request, reply) => {
        const q = request.query;
        const { limit, offset } = parsePagination(q);
        const where = { isPublished: true };
        const [rows, total] = await Promise.all([
            prisma.activity.findMany({
                where,
                orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
                take: limit,
                skip: offset,
            }),
            prisma.activity.count({ where }),
        ]);
        return reply.send(listEnvelope(rows.map(activityToApi), total, limit, offset));
    });
    app.get('/app/activities/:id', { preHandler: requireAppUser }, async (request, reply) => {
        const row = await prisma.activity.findUnique({
            where: { id: request.params.id },
        });
        if (!row || !row.isPublished) {
            return reply.code(404).send({ error: 'Atividade não encontrada.' });
        }
        return reply.send(activityToApi(row));
    });
    app.get('/app/libras-lessons', { preHandler: requireAppUser }, async (request, reply) => {
        const q = request.query;
        const { limit, offset } = parsePagination(q);
        const [rows, total] = await Promise.all([
            prisma.librasLesson.findMany({
                orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
                take: limit,
                skip: offset,
            }),
            prisma.librasLesson.count(),
        ]);
        return reply.send(listEnvelope(rows.map(librasLessonToApi), total, limit, offset));
    });
    app.get('/app/puzzle-games', { preHandler: requireAppUser }, async (request, reply) => {
        const q = request.query;
        const { limit, offset } = parsePagination(q);
        const where = { isPublished: true };
        const [rows, total] = await Promise.all([
            prisma.puzzleGame.findMany({
                where,
                orderBy: { updatedAt: 'desc' },
                take: limit,
                skip: offset,
            }),
            prisma.puzzleGame.count({ where }),
        ]);
        return reply.send(listEnvelope(rows.map(puzzleGameToApi), total, limit, offset));
    });
    app.get('/app/coloring-pages', { preHandler: requireAppUser }, async (request, reply) => {
        const q = request.query;
        const { limit, offset } = parsePagination(q);
        const where = { isPublished: true };
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
}
