import pLimit from 'p-limit';
import { presignedGetUrl } from './s3.js';
import { isPagesV2 } from './pagesV2/migrate.js';
/** Concorrência máxima para presigns numa única requisição de detalhe de livro. */
export const PRESIGN_CONCURRENCY = 16;
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
const KNOWN_MEDIA_BUCKETS = new Set([
    'covers',
    'pages',
    'presentations',
    'audios',
    'videos',
    'categories',
    'autores',
    'avatars',
]);
function peelStoragePathSegments(segments) {
    const parts = [...segments];
    while (parts.length > 0 && parts[0] === 'media')
        parts.shift();
    if (parts.length >= 2 && KNOWN_MEDIA_BUCKETS.has(parts[0])) {
        const bucket = parts[0];
        return { bucket, filePath: parts.slice(1).join('/') };
    }
    return null;
}
function parseStorageFromUrl(rawUrl) {
    if (!isNonEmptyString(rawUrl))
        return null;
    const raw = String(rawUrl).trim();
    try {
        if (/^https?:\/\//i.test(raw)) {
            const marker = '/media/';
            let pathname = new URL(raw).pathname;
            const idx = pathname.indexOf(marker);
            if (idx >= 0)
                pathname = pathname.slice(idx + marker.length);
            else
                pathname = pathname.replace(/^\/+/, '');
            const peeled = peelStoragePathSegments(pathname.split('/').filter(Boolean));
            if (peeled)
                return peeled;
        }
    }
    catch {
        /* ignore */
    }
    const clean = raw.replace(/^\/+/, '');
    if (!clean.includes('://')) {
        const peeled = peelStoragePathSegments(clean.split('/').filter(Boolean));
        if (peeled)
            return peeled;
    }
    return null;
}
export async function hydrateLegacyPagesMediaUrls(pages, cache) {
    if (!Array.isArray(pages))
        return pages;
    const next = JSON.parse(JSON.stringify(pages));
    const limit = pLimit(PRESIGN_CONCURRENCY);
    const resolve = (storage) => limit(() => resolveStorageUrl(cache, storage));
    await Promise.all(next.map(async (page) => {
        const bg = isRecord(page.background) ? page.background : null;
        if (bg) {
            const bgStorage = bg.storage ?? parseStorageFromUrl(bg.url);
            const signedBg = await resolve(bgStorage);
            if (signedBg)
                bg.url = signedBg;
            if (!bg.storage && bgStorage)
                bg.storage = bgStorage;
            page.background = bg;
        }
        const elements = Array.isArray(page.elements) ? page.elements : [];
        await Promise.all(elements.map(async (element) => {
            if (!isRecord(element))
                return;
            const fallbackStorage = parseStorageFromUrl(element.content);
            const signedEl = await resolve(element.storage ?? element.contentStorage ?? fallbackStorage);
            if (signedEl && element.type === 'image') {
                element.content = signedEl;
            }
            if (!element.storage && fallbackStorage && element.type === 'image') {
                element.storage = fallbackStorage;
            }
        }));
        // Fluxo por tipo (animated / interactive): `image_url` plano na página/cena.
        if (isNonEmptyString(page.image_url)) {
            const imgStorage = parseStorageFromUrl(page.image_url);
            const signedImg = await resolve(imgStorage);
            if (signedImg)
                page.image_url = signedImg;
        }
    }));
    return next;
}
/** Presign de URLs de assets do livro (capa, trilha, PDF, EPUB). */
export async function hydrateBookAssetUrls(book, cache) {
    const limit = pLimit(PRESIGN_CONCURRENCY);
    const resolve = (storage) => limit(() => resolveStorageUrl(cache, storage));
    const pairs = [
        ['soundtrackUrl', 'soundtrack_url'],
        ['pdfUrl', 'pdf_url'],
        ['epubUrl', 'epub_url'],
        ['coverImage', 'cover_image'],
    ];
    await Promise.all(pairs.map(async ([camel, snake]) => {
        const raw = book[camel] ?? book[snake];
        if (!isNonEmptyString(raw))
            return;
        const storage = parseStorageFromUrl(raw);
        if (!storage)
            return;
        const signed = await resolve(storage);
        if (signed) {
            book[camel] = signed;
            book[snake] = signed;
        }
    }));
    return book;
}
export async function hydratePagesV2MediaUrls(v2, cache) {
    if (!isPagesV2(v2))
        return v2;
    const next = JSON.parse(JSON.stringify(v2));
    const limit = pLimit(PRESIGN_CONCURRENCY);
    const resolve = (storage) => limit(() => resolveStorageUrl(cache, storage));
    await Promise.all(next.pages.map(async (page) => {
        const bg = isRecord(page.background) ? page.background : null;
        if (bg) {
            const bgStorage = bg.storage ?? parseStorageFromUrl(bg.url);
            const signedBg = await resolve(bgStorage);
            if (signedBg)
                bg.url = signedBg;
            if (!bg.storage && bgStorage)
                bg.storage = bgStorage;
            page.background = bg;
        }
        const nodes = Array.isArray(page.nodes) ? page.nodes : [];
        await Promise.all(nodes.map(async (node) => {
            if (!isRecord(node) || (node.type !== 'image' && node.type !== 'video'))
                return;
            const props = isRecord(node.props) ? node.props : null;
            if (!props)
                return;
            const nodeStorage = props.storage ?? parseStorageFromUrl(props.content);
            const signedNode = await resolve(nodeStorage);
            if (signedNode)
                props.content = signedNode;
            if (!props.storage && nodeStorage)
                props.storage = nodeStorage;
            if (node.type === 'video') {
                const posterStorage = props.posterStorage ?? parseStorageFromUrl(props.poster);
                const signedPoster = await resolve(posterStorage);
                if (signedPoster)
                    props.poster = signedPoster;
                if (!props.posterStorage && posterStorage)
                    props.posterStorage = posterStorage;
            }
            node.props = props;
        }));
    }));
    return next;
}
export function parseBookDetailView(raw) {
    const s = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
    if (s === 'legacy')
        return 'legacy';
    if (s === 'both')
        return 'both';
    return 'v2';
}
