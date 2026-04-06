import crypto from 'node:crypto';
import path from 'node:path';
import { prisma } from '../lib/prisma.js';
import { assertBucket, copyObject, deleteObject, listAllKeys, listObjects, objectExists, presignedGetUrl, presignedPutUrl, putObject, } from '../lib/s3.js';
import { requireCmsEditor } from '../plugins/auth.js';
import { generateThumbnail, getImageMeta, isSupportedImageType } from '../lib/imageProcessor.js';
const MEDIA_BUCKET_MAP = {
    image: 'covers',
    background: 'covers',
    audio: 'audios',
    video: 'videos',
    page: 'pages',
    category: 'categories',
    author: 'autores',
    avatar: 'avatars',
    presentation: 'presentations',
};
function parseBookId(request) {
    const q = request?.query?.bookId != null ? String(request.query.bookId) : '';
    const h = request?.headers?.['x-book-id'] != null ? String(request.headers['x-book-id']) : '';
    const raw = q || h;
    if (!raw)
        return null;
    if (!/^\d+$/.test(raw))
        return null;
    try {
        return BigInt(raw);
    }
    catch {
        return null;
    }
}
/** Chave completa no storage: dono (prefixo uid/) ou ficheiro do livro (mediaFile.bookId = livro do pedido). */
async function canAccessStorageObject(uid, bucket, objectKey, request) {
    if (!objectKey || objectKey.includes('..'))
        return false;
    if (objectKey.startsWith(`${uid}/`))
        return true;
    const linked = await prisma.mediaFile.findFirst({
        where: { bucketName: bucket, filePath: objectKey },
        select: { bookId: true },
    });
    const bid = parseBookId(request);
    return Boolean(linked?.bookId != null && bid != null && linked.bookId === bid);
}
function normalizeRel(v) {
    return String(v || '')
        .replace(/\\/g, '/')
        .replace(/\0/g, '')
        .replace(/^\/+/, '')
        .replace(/\/+$/g, '');
}
function assertSafeRelPath(rel) {
    const r = normalizeRel(rel);
    if (!r)
        return '';
    if (r.includes('..'))
        throw new Error('Caminho inválido.');
    return r;
}
function sanitizeFileName(name) {
    const base = path.posix.basename(String(name || '').replace(/\\/g, '/'));
    // remove chars problemáticos; mantém extensão
    return base
        .replace(/[^\w.\-() ]+/g, '_')
        .replace(/\s+/g, '_')
        .slice(0, 120);
}
function userFsBase(uid, root) {
    // root é relativo e vira parte do "filesystem" do usuário
    const safeRoot = assertSafeRelPath(root || 'library');
    return `${uid}/${safeRoot || 'library'}`;
}
function extType(name) {
    const ext = name.split('.').pop()?.toLowerCase() || '';
    if (['jpg', 'jpeg', 'png', 'webp', 'svg', 'gif'].includes(ext))
        return 'image';
    if (['mp3', 'wav', 'ogg'].includes(ext))
        return 'audio';
    if (['mp4', 'webm', 'mov'].includes(ext))
        return 'video';
    if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt'].includes(ext))
        return 'document';
    return 'other';
}
/** Mesma convenção do upload: `dir/.thumbs/{basename}.thumb.png`. */
function companionThumbnailKey(mediaKey) {
    const norm = String(mediaKey || '').replace(/\\/g, '/');
    const dir = path.posix.dirname(norm);
    const base = path.posix.basename(norm);
    return `${dir}/.thumbs/${base}.thumb.png`;
}
function eligibleForThumbnail(filePath, fileName) {
    const norm = String(filePath || '').replace(/\\/g, '/');
    if (norm.includes('/.thumbs/'))
        return false;
    return extType(fileName) === 'image';
}
async function attachThumbnailFields(bucket, filePath, fileName) {
    if (!eligibleForThumbnail(filePath, fileName))
        return {};
    const thumbKey = companionThumbnailKey(filePath);
    if (!(await objectExists(bucket, thumbKey)))
        return {};
    try {
        const thumbUrl = await presignedGetUrl(bucket, thumbKey, 3600);
        return { thumbStorageKey: thumbKey, ...(thumbUrl ? { thumbUrl } : {}) };
    }
    catch {
        return {};
    }
}
export async function registerMediaRoutes(app) {
    /**
     * Lista arquivos/pastas dentro do filesystem do usuário.
     * O client trabalha com `path` relativo (sem uid).
     */
    app.get('/media/list', { preHandler: requireCmsEditor }, async (request, reply) => {
        const mediaType = (request.query.mediaType || 'image');
        const bucket = MEDIA_BUCKET_MAP[mediaType] || MEDIA_BUCKET_MAP.image;
        try {
            assertBucket(bucket);
        }
        catch (e) {
            return reply.code(400).send({ error: e.message });
        }
        const uid = request.user.id;
        const root = request.query.root || 'library';
        const relPath = request.query.path || '';
        const recursive = String(request.query.recursive || '').toLowerCase() === 'true';
        const bookId = parseBookId(request);
        // Modo compartilhado por livro: lista todos os assets vinculados ao bookId,
        // independentemente de quem fez o upload/importação.
        if (bookId && root === 'library') {
            const rows = await prisma.mediaFile.findMany({
                where: { bookId, bucketName: bucket },
                orderBy: { createdAt: 'desc' },
            });
            const byPath = new Map();
            for (const row of rows) {
                if (!byPath.has(row.filePath)) {
                    byPath.set(row.filePath, row);
                }
            }
            const files = Array.from(byPath.values()).filter((row) => {
                if (!relPath)
                    return true;
                const safeRel = assertSafeRelPath(relPath);
                return row.filePath.includes(safeRel);
            });
            const fileItems = await Promise.all(files.map(async (row) => {
                let url = null;
                try {
                    url = await presignedGetUrl(bucket, row.filePath, 3600);
                }
                catch {
                    url = null;
                }
                const fileName = row.fileName || path.posix.basename(row.filePath);
                const thumbs = await attachThumbnailFields(bucket, row.filePath, fileName);
                return {
                    id: row.id.toString(),
                    name: fileName,
                    type: extType(fileName),
                    // Compat com o frontend atual (path relativo "virtual" da tela)
                    path: fileName,
                    // Chave real no storage (usar sempre que possível)
                    storageKey: row.filePath,
                    url,
                    ...thumbs,
                    metadata: {
                        file_size: Number(row.fileSize),
                        created_at: row.createdAt.toISOString(),
                        user_id: row.userId,
                    },
                    user_id: row.userId,
                    updated_at: row.updatedAt.toISOString(),
                    size: Number(row.fileSize),
                };
            }));
            return reply.send({ data: fileItems, error: null, bucket });
        }
        let prefix;
        try {
            const effectiveRoot = bookId && root === 'library'
                ? `books/${bookId.toString()}`
                : root;
            const base = userFsBase(uid, effectiveRoot);
            const rel = assertSafeRelPath(relPath);
            prefix = rel ? `${base}/${rel}` : base;
        }
        catch (e) {
            return reply.code(400).send({ error: e.message });
        }
        const { folders, files } = recursive
            ? { folders: [], files: (await listAllKeys(bucket, prefix)).map((fullPath) => ({
                    name: fullPath.split('/').pop() || fullPath,
                    id: fullPath,
                    fullPath,
                    size: undefined,
                    updated_at: undefined,
                })) }
            : await listObjects(bucket, prefix);
        const metaRows = await prisma.mediaFile.findMany({
            where: { userId: uid, bucketName: bucket },
        });
        const metaByPath = new Map(metaRows.map((m) => [m.filePath, m]));
        const effectiveRoot = bookId && root === 'library'
            ? `books/${bookId.toString()}`
            : root;
        const basePrefix = `${userFsBase(uid, effectiveRoot)}/`;
        const toRel = (full) => full.startsWith(basePrefix) ? full.slice(basePrefix.length) : full;
        const folderItems = folders.map((f) => ({
            id: null,
            name: f.name,
            path: toRel(f.path),
            type: 'folder',
            metadata: null,
            url: null,
        }));
        const fileItems = await Promise.all(files.map(async (file) => {
            const fullPath = file.fullPath;
            const type = extType(file.name);
            let url = null;
            try {
                // MinIO local normalmente não é público; então usamos URL assinada para tudo.
                url = await presignedGetUrl(bucket, fullPath, 3600);
            }
            catch {
                url = null;
            }
            const meta = metaByPath.get(fullPath);
            const thumbs = await attachThumbnailFields(bucket, fullPath, file.name);
            return {
                id: file.id,
                name: file.name,
                type,
                path: toRel(fullPath),
                url,
                ...thumbs,
                metadata: meta
                    ? {
                        file_size: Number(meta.fileSize),
                        created_at: meta.createdAt.toISOString(),
                        user_id: meta.userId,
                    }
                    : null,
                user_id: uid,
                updated_at: file.updated_at,
                size: file.size,
            };
        }));
        return reply.send({ data: [...folderItems, ...fileItems], error: null, bucket });
    });
    /**
     * URL assinada para uma chave já existente (ex.: imagens em pages_v2 após expirar presign do import).
     * Só devolve URL se a chave pertencer ao utilizador autenticado.
     */
    app.get('/media/signed-get', { preHandler: requireCmsEditor }, async (request, reply) => {
        const bucket = String(request.query.bucket || 'pages').trim();
        try {
            assertBucket(bucket);
        }
        catch (e) {
            return reply.code(400).send({ error: e.message });
        }
        const key = String(request.query.key || '').trim();
        const uid = request.user.id;
        if (!key) {
            return reply.code(400).send({ error: 'key obrigatorio.' });
        }
        let allowed = key.startsWith(`${uid}/`);
        if (!allowed) {
            // Permite acesso a mídia vinculada a livro (compartilhada entre editores),
            // mesmo que o arquivo tenha sido enviado por outro usuário.
            const linkedMedia = await prisma.mediaFile.findFirst({
                where: { bucketName: bucket, filePath: key, bookId: { not: null } },
                select: { id: true },
            });
            allowed = Boolean(linkedMedia);
        }
        if (!allowed) {
            return reply.code(403).send({ error: 'Acesso negado.' });
        }
        try {
            const url = await presignedGetUrl(bucket, key, 7200);
            return reply.send({ data: { url }, error: null });
        }
        catch (e) {
            return reply.code(500).send({ error: e.message || 'Falha ao assinar URL.' });
        }
    });
    /**
     * Upload (multipart) com key gerada pelo backend.
     * Client informa só `root` e `path` (pasta relativa); o arquivo vira um nome único.
     */
    app.post('/media/upload', { preHandler: requireCmsEditor }, async (request, reply) => {
        const mediaType = (request.query.mediaType || 'image');
        const bucket = MEDIA_BUCKET_MAP[mediaType] || MEDIA_BUCKET_MAP.image;
        try {
            assertBucket(bucket);
        }
        catch (e) {
            return reply.code(400).send({ error: e.message });
        }
        const uid = request.user.id;
        const root = request.query.root || 'library';
        const relDirRaw = request.query.path || '';
        const bookId = parseBookId(request);
        let baseDir;
        try {
            // Se vier bookId, guardamos dentro de uma pasta por livro
            const effectiveRoot = bookId && root === 'library'
                ? `books/${bookId.toString()}`
                : root;
            baseDir = userFsBase(uid, effectiveRoot);
            const relDir = assertSafeRelPath(relDirRaw);
            if (relDir) {
                // Compat: algumas telas podem enviar `path` já contendo filename (ex: "categoria_123.jpg").
                // Nesse caso, tratamos como "diretório = dirname(path)" e ignoramos o filename, porque o backend gera um nome único.
                const baseName = path.posix.basename(relDir);
                const hasDot = baseName.includes('.');
                if (hasDot) {
                    const parent = path.posix.dirname(relDir);
                    if (parent && parent !== '.')
                        baseDir = `${baseDir}/${parent}`;
                }
                else {
                    baseDir = `${baseDir}/${relDir}`;
                }
            }
        }
        catch (e) {
            return reply.code(400).send({ error: e.message });
        }
        const parts = request.parts();
        let buf = null;
        let ct = 'application/octet-stream';
        let originalName = '';
        for await (const part of parts) {
            if (part.type === 'file' && part.fieldname === 'file') {
                buf = await part.toBuffer();
                ct = part.mimetype || ct;
                originalName = part.filename || '';
            }
        }
        if (!buf)
            return reply.code(400).send({ error: 'Ficheiro em falta.' });
        const safeName = sanitizeFileName(originalName || 'file');
        const stamp = crypto.randomUUID();
        const key = `${baseDir}/${stamp}-${safeName}`;
        await putObject(bucket, key, buf, ct);
        // Gerar thumbnail PNG para imagens (inclui 1.º frame de GIF animado).
        let thumbKey = null;
        let imageMeta = null;
        if (isSupportedImageType(ct)) {
            try {
                const [thumbBuf, meta] = await Promise.all([
                    generateThumbnail(buf, ct, { width: 400, height: 300 }),
                    getImageMeta(buf),
                ]);
                if (thumbBuf) {
                    thumbKey = `${baseDir}/.thumbs/${stamp}-${safeName}.thumb.png`;
                    await putObject(bucket, thumbKey, thumbBuf, 'image/png');
                }
                if (meta)
                    imageMeta = { width: meta.width, height: meta.height };
            }
            catch {
                /* thumbnail é best-effort; nunca bloqueia o upload */
            }
        }
        try {
            await prisma.mediaFile.create({
                data: {
                    userId: uid,
                    bookId,
                    filePath: key,
                    fileName: safeName,
                    fileType: ct,
                    fileSize: BigInt(buf.length),
                    bucketName: bucket,
                },
            });
        }
        catch {
            /* metadados opcionais */
        }
        let url = null;
        let thumbUrl = null;
        try {
            url = await presignedGetUrl(bucket, key, 3600);
        }
        catch {
            url = null;
        }
        if (thumbKey) {
            try {
                thumbUrl = await presignedGetUrl(bucket, thumbKey, 3600);
            }
            catch {
                thumbUrl = null;
            }
        }
        const effectiveRoot = bookId && root === 'library'
            ? `books/${bookId.toString()}`
            : root;
        const basePrefix = `${userFsBase(uid, effectiveRoot)}/`;
        const relPath = key.startsWith(basePrefix) ? key.slice(basePrefix.length) : key;
        return reply.send({
            data: {
                path: relPath,
                url,
                name: safeName,
                thumbUrl: thumbUrl ?? undefined,
                ...(imageMeta ? { width: imageMeta.width, height: imageMeta.height } : {}),
            },
            error: null,
            bucket,
        });
    });
    /**
     * Substitui um arquivo existente mantendo o mesmo caminho.
     * Útil para "editar/substituir imagem" sem quebrar referências já salvas.
     */
    app.post('/media/replace', { preHandler: requireCmsEditor }, async (request, reply) => {
        const mediaType = (request.query.mediaType || 'image');
        const bucket = MEDIA_BUCKET_MAP[mediaType] || MEDIA_BUCKET_MAP.image;
        try {
            assertBucket(bucket);
        }
        catch (e) {
            return reply.code(400).send({ error: e.message });
        }
        const uid = request.user.id;
        const root = request.query.root || 'library';
        const relPathRaw = String(request.query.path || '').trim();
        const rawObjectKey = String(request.query.key || '').trim();
        const bookId = parseBookId(request);
        let key;
        let responseRelPath;
        if (rawObjectKey) {
            const ok = await canAccessStorageObject(uid, bucket, rawObjectKey, request);
            if (!ok) {
                return reply.code(403).send({ error: 'Acesso negado.' });
            }
            key = rawObjectKey;
            responseRelPath = path.posix.basename(key);
        }
        else {
            if (!relPathRaw) {
                return reply.code(400).send({ error: 'path obrigatório.' });
            }
            try {
                const effectiveRoot = bookId && root === 'library'
                    ? `books/${bookId.toString()}`
                    : root;
                const base = userFsBase(uid, effectiveRoot);
                const rel = assertSafeRelPath(relPathRaw);
                if (!rel)
                    return reply.code(400).send({ error: 'path inválido.' });
                key = `${base}/${rel}`;
                responseRelPath = relPathRaw;
            }
            catch (e) {
                return reply.code(400).send({ error: e.message });
            }
        }
        const parts = request.parts();
        let buf = null;
        let ct = 'application/octet-stream';
        for await (const part of parts) {
            if (part.type === 'file' && part.fieldname === 'file') {
                buf = await part.toBuffer();
                ct = part.mimetype || ct;
            }
        }
        if (!buf)
            return reply.code(400).send({ error: 'Ficheiro em falta.' });
        await putObject(bucket, key, buf, ct);
        if (isSupportedImageType(ct)) {
            try {
                const thumbBuf = await generateThumbnail(buf, ct, { width: 400, height: 300 });
                if (thumbBuf) {
                    const tKey = companionThumbnailKey(key);
                    await putObject(bucket, tKey, thumbBuf, 'image/png');
                }
            }
            catch {
                /* miniatura best-effort */
            }
        }
        else {
            try {
                const tKey = companionThumbnailKey(key);
                if (await objectExists(bucket, tKey))
                    await deleteObject(bucket, tKey);
            }
            catch {
                /* ignore */
            }
        }
        const metadataUpdate = {
            fileName: path.posix.basename(key),
            fileType: ct,
            fileSize: BigInt(buf.length),
            updatedAt: new Date(),
        };
        const updated = await prisma.mediaFile.updateMany({
            where: rawObjectKey
                ? { bucketName: bucket, filePath: key }
                : { userId: uid, bucketName: bucket, filePath: key },
            data: metadataUpdate,
        });
        if (updated.count === 0) {
            await prisma.mediaFile.create({
                data: {
                    userId: uid,
                    bookId,
                    filePath: key,
                    fileName: metadataUpdate.fileName,
                    fileType: metadataUpdate.fileType,
                    fileSize: metadataUpdate.fileSize,
                    bucketName: bucket,
                },
            });
        }
        let url = null;
        try {
            url = await presignedGetUrl(bucket, key, 3600);
        }
        catch {
            url = null;
        }
        return reply.send({
            data: { path: responseRelPath, url, name: path.posix.basename(key) },
            error: null,
            bucket,
        });
    });
    app.post('/media/folder', { preHandler: requireCmsEditor }, async (request, reply) => {
        const mediaType = (request.body?.mediaType || 'image');
        const bucket = MEDIA_BUCKET_MAP[mediaType] || MEDIA_BUCKET_MAP.image;
        try {
            assertBucket(bucket);
        }
        catch (e) {
            return reply.code(400).send({ error: e.message });
        }
        const uid = request.user.id;
        const root = request.body?.root || 'library';
        const relFolder = request.body?.path || '';
        const bookId = parseBookId(request);
        let folderKey;
        try {
            const effectiveRoot = bookId && root === 'library'
                ? `books/${bookId.toString()}`
                : root;
            const base = userFsBase(uid, effectiveRoot);
            const rel = assertSafeRelPath(relFolder);
            folderKey = rel ? `${base}/${rel}` : base;
        }
        catch (e) {
            return reply.code(400).send({ error: e.message });
        }
        const key = `${folderKey}/.folder`;
        await putObject(bucket, key, Buffer.from('{}'), 'application/json');
        return reply.send({ ok: true });
    });
    app.delete('/media/object', { preHandler: requireCmsEditor }, async (request, reply) => {
        const mediaType = (request.query.mediaType || 'image');
        const bucket = MEDIA_BUCKET_MAP[mediaType] || MEDIA_BUCKET_MAP.image;
        try {
            assertBucket(bucket);
        }
        catch (e) {
            return reply.code(400).send({ error: e.message });
        }
        const uid = request.user.id;
        const root = request.query.root || 'library';
        const relPath = String(request.query.path || '').trim();
        const rawObjectKey = String(request.query.key || '').trim();
        let key;
        if (rawObjectKey) {
            const ok = await canAccessStorageObject(uid, bucket, rawObjectKey, request);
            if (!ok) {
                return reply.code(403).send({ error: 'Acesso negado.' });
            }
            key = rawObjectKey;
        }
        else {
            if (!relPath)
                return reply.code(400).send({ error: 'path obrigatório.' });
            const bookId = parseBookId(request);
            try {
                const effectiveRoot = bookId && root === 'library'
                    ? `books/${bookId.toString()}`
                    : root;
                const base = userFsBase(uid, effectiveRoot);
                const rel = assertSafeRelPath(relPath);
                key = `${base}/${rel}`;
            }
            catch (e) {
                return reply.code(400).send({ error: e.message });
            }
        }
        try {
            await deleteObject(bucket, key);
        }
        catch (e) {
            return reply.code(500).send({ error: e.message || 'Falha ao apagar no storage.' });
        }
        await prisma.mediaFile.deleteMany({ where: { bucketName: bucket, filePath: key } });
        return reply.send({ ok: true });
    });
    app.post('/media/rename', { preHandler: requireCmsEditor }, async (request, reply) => {
        const mediaType = (request.body?.mediaType || 'image');
        const bucket = MEDIA_BUCKET_MAP[mediaType] || MEDIA_BUCKET_MAP.image;
        try {
            assertBucket(bucket);
        }
        catch (e) {
            return reply.code(400).send({ error: e.message });
        }
        const uid = request.user.id;
        const root = request.body?.root || 'library';
        const relPath = String(request.body?.path || '').trim();
        const rawObjectKey = String(request.body?.key || '').trim();
        const fileName = sanitizeFileName(String(request.body?.fileName || '').trim());
        if (!fileName)
            return reply.code(400).send({ error: 'fileName obrigatório.' });
        let key;
        if (rawObjectKey) {
            const ok = await canAccessStorageObject(uid, bucket, rawObjectKey, request);
            if (!ok)
                return reply.code(403).send({ error: 'Acesso negado.' });
            key = rawObjectKey;
        }
        else {
            if (!relPath)
                return reply.code(400).send({ error: 'path obrigatório.' });
            const bookId = parseBookId(request);
            try {
                const effectiveRoot = bookId && root === 'library'
                    ? `books/${bookId.toString()}`
                    : root;
                const base = userFsBase(uid, effectiveRoot);
                key = `${base}/${assertSafeRelPath(relPath)}`;
            }
            catch (e) {
                return reply.code(400).send({ error: e.message });
            }
        }
        await prisma.mediaFile.updateMany({
            where: { bucketName: bucket, filePath: key },
            data: { fileName, updatedAt: new Date() },
        });
        return reply.send({ ok: true });
    });
    app.post('/media/move', { preHandler: requireCmsEditor }, async (request, reply) => {
        const mediaType = (request.body?.mediaType || 'image');
        const bucket = MEDIA_BUCKET_MAP[mediaType] || MEDIA_BUCKET_MAP.image;
        try {
            assertBucket(bucket);
        }
        catch (e) {
            return reply.code(400).send({ error: e.message });
        }
        const uid = request.user.id;
        const root = request.body?.root || 'library';
        const bookId = parseBookId(request);
        const fromRel = String(request.body?.from || '').trim();
        const toRel = String(request.body?.to || '').trim();
        const rawFromKey = String(request.body?.fromKey || '').trim();
        const rawToKey = String(request.body?.toKey || '').trim();
        if ((!fromRel || !toRel) && (!rawFromKey || !rawToKey)) {
            return reply.code(400).send({ error: 'from e to obrigatórios.' });
        }
        let fromKey;
        let toKey;
        if (rawFromKey && rawToKey) {
            const ok = await canAccessStorageObject(uid, bucket, rawFromKey, request);
            if (!ok) {
                return reply.code(403).send({ error: 'Acesso negado.' });
            }
            const fromDir = path.posix.dirname(rawFromKey);
            const toDir = path.posix.dirname(rawToKey);
            if (!fromDir || fromDir === '.' || fromDir !== toDir) {
                return reply.code(400).send({ error: 'A renomeação deve manter a mesma pasta.' });
            }
            fromKey = rawFromKey;
            toKey = `${fromDir}/${sanitizeFileName(path.posix.basename(rawToKey))}`;
        }
        else {
            try {
                const effectiveRoot = bookId && root === 'library'
                    ? `books/${bookId.toString()}`
                    : root;
                const base = userFsBase(uid, effectiveRoot);
                fromKey = `${base}/${assertSafeRelPath(fromRel)}`;
                toKey = `${base}/${assertSafeRelPath(toRel)}`;
            }
            catch (e) {
                return reply.code(400).send({ error: e.message });
            }
        }
        await copyObject(bucket, fromKey, toKey);
        await deleteObject(bucket, fromKey);
        await prisma.mediaFile.updateMany({
            where: rawFromKey
                ? { bucketName: bucket, filePath: fromKey }
                : { userId: uid, bucketName: bucket, filePath: fromKey },
            data: { filePath: toKey, fileName: path.posix.basename(toKey) },
        });
        return reply.send({ ok: true });
    });
    /**
     * Presign (para uploads diretos no storage).
     * Observação: o backend gera o key com base no usuário; o client nunca envia uid.
     */
    app.post('/media/presign', { preHandler: requireCmsEditor }, async (request, reply) => {
        const mediaType = (request.body?.mediaType || 'image');
        const bucket = MEDIA_BUCKET_MAP[mediaType] || MEDIA_BUCKET_MAP.image;
        try {
            assertBucket(bucket);
        }
        catch (e) {
            return reply.code(400).send({ error: e.message });
        }
        const uid = request.user.id;
        const root = request.body?.root || 'library';
        const bookId = parseBookId(request);
        const relDir = request.body?.path || '';
        const ct = request.body?.contentType || 'application/octet-stream';
        const safeName = sanitizeFileName(request.body?.fileName || 'file');
        let dirKey;
        try {
            const effectiveRoot = bookId && root === 'library'
                ? `books/${bookId.toString()}`
                : root;
            dirKey = userFsBase(uid, effectiveRoot);
            const rel = assertSafeRelPath(relDir);
            if (rel)
                dirKey = `${dirKey}/${rel}`;
        }
        catch (e) {
            return reply.code(400).send({ error: e.message });
        }
        const stamp = crypto.randomUUID();
        const key = `${dirKey}/${stamp}-${safeName}`;
        const putUrl = await presignedPutUrl(bucket, key, ct);
        const getUrl = await presignedGetUrl(bucket, key, 3600);
        const effectiveRoot = bookId && root === 'library'
            ? `books/${bookId.toString()}`
            : root;
        const basePrefix = `${userFsBase(uid, effectiveRoot)}/`;
        const relPath = key.startsWith(basePrefix) ? key.slice(basePrefix.length) : key;
        return reply.send({ data: { bucket, path: relPath, putUrl, url: getUrl, name: safeName } });
    });
}
