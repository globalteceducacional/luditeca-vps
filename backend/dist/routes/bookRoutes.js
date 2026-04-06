import { prisma } from '../lib/prisma.js';
import { jsonSafe } from '../lib/serialize.js';
import { requireCmsEditor } from '../plugins/auth.js';
import { requireAuth } from '../plugins/auth.js';
import { copyObject, deletePrefix, deleteObject, listAllKeys, presignedGetUrl, } from '../lib/s3.js';
import { isPagesV2, migratePagesLegacyToV2 } from '../lib/pagesV2/migrate.js';
function toBigIntOrNull(v) {
    if (v === null || v === undefined || v === '')
        return null;
    const n = BigInt(String(v));
    return n;
}
function isNonEmptyString(v) {
    return typeof v === 'string' && v.trim().length > 0;
}
function isRecord(v) {
    return !!v && typeof v === 'object' && !Array.isArray(v);
}
async function resolveStorageUrl(cache, storage) {
    if (!isRecord(storage))
        return null;
    const bucket = isNonEmptyString(storage.bucket) ? String(storage.bucket) : '';
    const filePath = isNonEmptyString(storage.filePath) ? String(storage.filePath) : '';
    if (!bucket || !filePath)
        return null;
    const key = `${bucket}:${filePath}`;
    if (cache.has(key))
        return cache.get(key) || null;
    try {
        const signed = await presignedGetUrl(bucket, filePath, 3600);
        cache.set(key, signed);
        return signed;
    }
    catch {
        return null;
    }
}
function parseStorageFromUrl(rawUrl) {
    if (!isNonEmptyString(rawUrl))
        return null;
    try {
        const parsed = new URL(String(rawUrl));
        const path = parsed.pathname.replace(/^\/+/, '');
        const [bucket, ...rest] = path.split('/');
        if (!bucket || rest.length === 0)
            return null;
        return { bucket, filePath: rest.join('/') };
    }
    catch {
        return null;
    }
}
async function hydrateLegacyPagesMediaUrls(pages, cache) {
    if (!Array.isArray(pages))
        return pages;
    const next = JSON.parse(JSON.stringify(pages));
    for (const page of next) {
        const bg = isRecord(page.background) ? page.background : null;
        if (bg) {
            const bgStorage = bg.storage ?? parseStorageFromUrl(bg.url);
            const signedBg = await resolveStorageUrl(cache, bgStorage);
            if (signedBg)
                bg.url = signedBg;
            if (!bg.storage && bgStorage)
                bg.storage = bgStorage;
            page.background = bg;
        }
        const elements = Array.isArray(page.elements) ? page.elements : [];
        for (const element of elements) {
            if (!isRecord(element))
                continue;
            const fallbackStorage = parseStorageFromUrl(element.content);
            const signedEl = await resolveStorageUrl(cache, element.storage ?? element.contentStorage ?? fallbackStorage);
            if (signedEl && element.type === 'image') {
                element.content = signedEl;
            }
            if (!element.storage && fallbackStorage && element.type === 'image') {
                element.storage = fallbackStorage;
            }
        }
    }
    return next;
}
async function hydratePagesV2MediaUrls(v2, cache) {
    if (!isPagesV2(v2))
        return v2;
    const next = JSON.parse(JSON.stringify(v2));
    for (const page of next.pages) {
        const bg = isRecord(page.background) ? page.background : null;
        if (bg) {
            const bgStorage = bg.storage ?? parseStorageFromUrl(bg.url);
            const signedBg = await resolveStorageUrl(cache, bgStorage);
            if (signedBg)
                bg.url = signedBg;
            if (!bg.storage && bgStorage)
                bg.storage = bgStorage;
            page.background = bg;
        }
        const nodes = Array.isArray(page.nodes) ? page.nodes : [];
        for (const node of nodes) {
            if (!isRecord(node) || (node.type !== 'image' && node.type !== 'video'))
                continue;
            const props = isRecord(node.props) ? node.props : null;
            if (!props)
                continue;
            const nodeStorage = props.storage ?? parseStorageFromUrl(props.content);
            const signedNode = await resolveStorageUrl(cache, nodeStorage);
            if (signedNode)
                props.content = signedNode;
            if (!props.storage && nodeStorage)
                props.storage = nodeStorage;
            if (node.type === 'video') {
                const posterStorage = props.posterStorage ?? parseStorageFromUrl(props.poster);
                const signedPoster = await resolveStorageUrl(cache, posterStorage);
                if (signedPoster)
                    props.poster = signedPoster;
                if (!props.posterStorage && posterStorage)
                    props.posterStorage = posterStorage;
            }
            node.props = props;
        }
    }
    return next;
}
async function finalizeImportSession({ userId, importSessionId, bookId, }) {
    const srcBase = `${userId}/imports/${importSessionId}`;
    const dstBase = `${userId}/books/${bookId.toString()}`;
    const buckets = ['pages', 'presentations'];
    const moved = [];
    for (const bucket of buckets) {
        const keys = await listAllKeys(bucket, srcBase);
        for (const fromKey of keys) {
            const suffix = fromKey.startsWith(`${srcBase}/`)
                ? fromKey.slice(srcBase.length + 1)
                : fromKey;
            const toKey = `${dstBase}/${suffix}`;
            await copyObject(bucket, fromKey, toKey);
            await deleteObject(bucket, fromKey);
            moved.push({ bucket, from: fromKey, to: toKey });
        }
    }
    for (const m of moved) {
        await prisma.mediaFile.updateMany({
            where: { userId, bucketName: m.bucket, filePath: m.from },
            data: { bookId, filePath: m.to },
        });
    }
    return { srcBase, dstBase, moved };
}
function buildImportRemapLookup(remap) {
    const byFrom = new Map();
    for (const m of remap.moved) {
        byFrom.set(`${m.bucket}:${m.from}`, { bucket: m.bucket, to: m.to });
    }
    return byFrom;
}
/** Atualiza `filePath` no JSON após mover objetos de `imports/{session}` → `books/{id}`. */
function remapImportedStorageInPages(pages, remap) {
    if (!Array.isArray(pages))
        return pages;
    const byFrom = buildImportRemapLookup(remap);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const next = pages.map((p) => {
        if (!p || typeof p !== 'object')
            return p;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const page = { ...p };
        const bg = page.background;
        if (bg && typeof bg === 'object') {
            const storage = bg.storage;
            if (storage &&
                storage.importSessionId === remap.importSessionId &&
                storage.bucket &&
                storage.filePath) {
                const hit = byFrom.get(`${storage.bucket}:${storage.filePath}`);
                if (hit) {
                    bg.storage = { bucket: hit.bucket, filePath: hit.to };
                    bg.url = '';
                }
            }
            page.background = bg;
        }
        const rawEls = page.elements;
        if (Array.isArray(rawEls)) {
            page.elements = rawEls.map((el) => {
                if (!el || typeof el !== 'object')
                    return el;
                const e = { ...el };
                const storage = e.storage;
                if (storage &&
                    storage.importSessionId === remap.importSessionId &&
                    storage.bucket &&
                    storage.filePath) {
                    const hit = byFrom.get(`${storage.bucket}:${storage.filePath}`);
                    if (hit) {
                        e.storage = { bucket: hit.bucket, filePath: hit.to };
                        e.content = '';
                    }
                }
                return e;
            });
        }
        return page;
    });
    return next;
}
function remapImportedStorageInPagesV2(v2, remap) {
    if (!isPagesV2(v2))
        return v2;
    const next = JSON.parse(JSON.stringify(v2));
    const byFrom = buildImportRemapLookup(remap);
    for (const page of next.pages) {
        const bg = page.background;
        if (bg && typeof bg === 'object') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const storage = bg.storage;
            if (storage &&
                storage.importSessionId === remap.importSessionId &&
                storage.bucket &&
                storage.filePath) {
                const hit = byFrom.get(`${storage.bucket}:${storage.filePath}`);
                if (hit) {
                    bg.storage = { bucket: hit.bucket, filePath: hit.to };
                    bg.url = '';
                }
            }
        }
        const nodes = Array.isArray(page.nodes) ? page.nodes : [];
        for (const node of nodes) {
            if (!node || typeof node !== 'object')
                continue;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const n = node;
            if (n.type !== 'image' && n.type !== 'video')
                continue;
            const props = n.props && typeof n.props === 'object' ? { ...n.props } : {};
            const storage = props.storage;
            if (storage &&
                storage.importSessionId === remap.importSessionId &&
                storage.bucket &&
                storage.filePath) {
                const hit = byFrom.get(`${storage.bucket}:${storage.filePath}`);
                if (hit) {
                    props.storage = { bucket: hit.bucket, filePath: hit.to };
                    props.content = '';
                    n.props = props;
                }
            }
            if (n.type === 'video' &&
                props.posterStorage &&
                props.posterStorage.importSessionId === remap.importSessionId &&
                props.posterStorage.bucket &&
                props.posterStorage.filePath) {
                const hitPoster = byFrom.get(`${props.posterStorage.bucket}:${props.posterStorage.filePath}`);
                if (hitPoster) {
                    props.posterStorage = { bucket: hitPoster.bucket, filePath: hitPoster.to };
                    props.poster = '';
                    n.props = props;
                }
            }
        }
    }
    return next;
}
async function signLegacyPagesMediaUrls(pages) {
    if (!Array.isArray(pages))
        return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const page of pages) {
        const bg = page?.background;
        if (bg && typeof bg === 'object') {
            const storage = bg.storage;
            if (storage?.bucket && storage?.filePath && isNonEmptyString(storage.filePath)) {
                try {
                    bg.url = await presignedGetUrl(String(storage.bucket), String(storage.filePath), 3600);
                }
                catch {
                    /* manter url existente */
                }
            }
        }
        const elements = page?.elements;
        if (!Array.isArray(elements))
            continue;
        for (const el of elements) {
            if (!el || typeof el !== 'object')
                continue;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const e = el;
            if (e.type !== 'image')
                continue;
            const st = e.storage;
            if (st?.bucket && st?.filePath && isNonEmptyString(st.filePath)) {
                try {
                    e.content = await presignedGetUrl(String(st.bucket), String(st.filePath), 3600);
                }
                catch {
                    /* ignorar */
                }
            }
        }
    }
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
        const resp = bookResponse(b);
        const mediaUrlCache = new Map();
        resp.pages = await hydrateLegacyPagesMediaUrls(resp.pages, mediaUrlCache);
        resp.pages_v2 = await hydratePagesV2MediaUrls((resp.pagesV2 ?? resp.pages_v2), mediaUrlCache);
        const pagesV2 = (resp.pagesV2 ?? resp.pages_v2);
        const pagesLegacy = resp.pages;
        const hasV2 = isPagesV2(pagesV2);
        if (!hasV2 && Array.isArray(pagesLegacy) && pagesLegacy.length > 0) {
            // Não salvamos no GET para evitar efeitos colaterais.
            resp.needsMigration = true;
            resp.pages_v2_suggested = migratePagesLegacyToV2(pagesLegacy);
        }
        return reply.send(resp);
    });
    app.post('/books', { preHandler: requireCmsEditor }, async (request, reply) => {
        const body = request.body;
        let pages = body.pages ?? [
            { id: String(Date.now()), background: '', elements: [], orientation: 'portrait' },
        ];
        const pagesV2 = (body.pages_v2 ?? body.pagesV2);
        const importSessionId = isNonEmptyString(body.import_session_id)
            ? String(body.import_session_id).trim()
            : null;
        const createData = {
            title: String(body.title || ''),
            author: body.author != null ? String(body.author) : null,
            description: body.description != null ? String(body.description) : null,
            coverImage: body.cover_image != null ? String(body.cover_image) : null,
            pages: pages,
            authorId: toBigIntOrNull(body.author_id),
            categoryId: toBigIntOrNull(body.category_id),
            linkSlidebook: body.link_slidebook != null ? String(body.link_slidebook) : null,
        };
        if (pagesV2 != null) {
            createData.pagesV2 = pagesV2;
        }
        const created = await prisma.book.create({
            data: createData,
            include: { authorRel: true },
        });
        let responseBook = created;
        if (importSessionId) {
            const userId = request.user?.id;
            if (userId) {
                const result = await finalizeImportSession({
                    userId,
                    importSessionId,
                    bookId: BigInt(created.id),
                });
                const remapCtx = {
                    importSessionId,
                    moved: result.moved,
                };
                pages = remapImportedStorageInPages(pages, remapCtx);
                let nextV2;
                if (isPagesV2(pagesV2)) {
                    nextV2 = remapImportedStorageInPagesV2(pagesV2, remapCtx);
                }
                else {
                    nextV2 = migratePagesLegacyToV2(pages);
                }
                const mediaUrlCache = new Map();
                nextV2 = await hydratePagesV2MediaUrls(nextV2, mediaUrlCache);
                await signLegacyPagesMediaUrls(pages);
                await prisma.book.update({
                    where: { id: BigInt(created.id) },
                    data: { pages: pages, pagesV2: nextV2 },
                });
                const refreshed = await prisma.book.findUnique({
                    where: { id: BigInt(created.id) },
                    include: { authorRel: true },
                });
                if (refreshed)
                    responseBook = refreshed;
            }
        }
        return reply.code(201).send(bookResponse(responseBook));
    });
    app.patch('/books/:id', { preHandler: requireCmsEditor }, async (request, reply) => {
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
        if ('pages_v2' in clean)
            data.pagesV2 = clean.pages_v2;
        if ('pagesV2' in clean)
            data.pagesV2 = clean.pagesV2;
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
    app.delete('/books/:id', { preHandler: requireCmsEditor }, async (request, reply) => {
        const id = BigInt(request.params.id);
        const bookIdAsString = id.toString();
        // Limpa mídias vinculadas ao livro (evita acúmulo no storage)
        const media = await prisma.mediaFile.findMany({
            where: { bookId: id },
            select: { bucketName: true, filePath: true, userId: true },
        });
        for (const m of media) {
            try {
                await deleteObject(m.bucketName, m.filePath);
            }
            catch {
                // Se já não existir no storage, seguimos.
            }
        }
        await prisma.mediaFile.deleteMany({ where: { bookId: id } });
        // Limpeza extra por prefixo de pasta do livro (user/books/{id}) em todos os buckets.
        // Cobre arquivos órfãos e remove o acúmulo no storage local.
        const userIds = Array.from(new Set(media.map((m) => m.userId).filter(Boolean)));
        const buckets = [
            'covers',
            'pages',
            'presentations',
            'audios',
            'videos',
            'categories',
            'autores',
            'avatars',
        ];
        for (const userId of userIds) {
            const prefix = `${userId}/books/${bookIdAsString}`;
            for (const bucket of buckets) {
                try {
                    await deletePrefix(bucket, prefix);
                }
                catch {
                    // Se não houver nada no bucket/prefixo, seguimos.
                }
            }
        }
        await prisma.book.delete({ where: { id } });
        return reply.code(204).send();
    });
}
