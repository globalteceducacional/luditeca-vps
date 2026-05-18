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
    }));
    return next;
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
