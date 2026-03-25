import { prisma } from '../lib/prisma.js';
import { jsonSafe } from '../lib/serialize.js';
import { requireAuth } from '../plugins/auth.js';
function toBigIntOrNull(v) {
    if (v === null || v === undefined || v === '')
        return null;
    const n = BigInt(String(v));
    return n;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function bookResponse(b) {
    if (!b)
        return null;
    const { authorRel, categoryRel, ...rest } = b;
    return {
        ...jsonSafe(rest),
        authors: authorRel
            ? { id: Number(authorRel.id), name: authorRel.name }
            : null,
    };
}
export async function registerBookRoutes(app) {
    app.get('/books', { preHandler: requireAuth }, async (_request, reply) => {
        const rows = await prisma.book.findMany({
            orderBy: { createdAt: 'desc' },
            include: { authorRel: true },
        });
        return reply.send(rows.map((r) => bookResponse(r)));
    });
    app.get('/books/:id', { preHandler: requireAuth }, async (request, reply) => {
        const id = BigInt(request.params.id);
        const b = await prisma.book.findUnique({
            where: { id },
            include: { authorRel: true },
        });
        if (!b)
            return reply.code(404).send({ error: 'Livro não encontrado.' });
        return reply.send(bookResponse(b));
    });
    app.post('/books', { preHandler: requireAuth }, async (request, reply) => {
        const body = request.body;
        const pages = body.pages ?? [
            { id: String(Date.now()), background: '', elements: [], orientation: 'portrait' },
        ];
        const created = await prisma.book.create({
            data: {
                title: String(body.title || ''),
                author: body.author != null ? String(body.author) : null,
                description: body.description != null ? String(body.description) : null,
                coverImage: body.cover_image != null ? String(body.cover_image) : null,
                pages: pages,
                authorId: toBigIntOrNull(body.author_id),
                categoryId: toBigIntOrNull(body.category_id),
                linkSlidebook: body.link_slidebook != null ? String(body.link_slidebook) : null,
            },
            include: { authorRel: true },
        });
        return reply.code(201).send(bookResponse(created));
    });
    app.patch('/books/:id', { preHandler: requireAuth }, async (request, reply) => {
        const id = BigInt(request.params.id);
        const body = request.body;
        const clean = { ...body };
        delete clean.authors;
        const data = {};
        if ('title' in clean)
            data.title = clean.title;
        if ('author' in clean)
            data.author = clean.author;
        if ('description' in clean)
            data.description = clean.description;
        if ('cover_image' in clean)
            data.coverImage = clean.cover_image;
        if ('pages' in clean)
            data.pages = clean.pages;
        if ('author_id' in clean)
            data.authorId = toBigIntOrNull(clean.author_id);
        if ('category_id' in clean)
            data.categoryId = toBigIntOrNull(clean.category_id);
        if ('link_slidebook' in clean)
            data.linkSlidebook = clean.link_slidebook;
        const updated = await prisma.book.update({
            where: { id },
            data: data,
            include: { authorRel: true },
        });
        return reply.send(bookResponse(updated));
    });
    app.delete('/books/:id', { preHandler: requireAuth }, async (request, reply) => {
        const id = BigInt(request.params.id);
        await prisma.book.delete({ where: { id } });
        return reply.code(204).send();
    });
}
