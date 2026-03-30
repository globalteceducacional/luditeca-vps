import type { FastifyInstance } from 'fastify';
import crypto from 'node:crypto';
import path from 'node:path';
import { prisma } from '../lib/prisma.js';
import {
  assertBucket,
  copyObject,
  deleteObject,
  listAllKeys,
  listObjects,
  presignedGetUrl,
  presignedPutUrl,
  putObject,
} from '../lib/s3.js';
import { requireCmsEditor } from '../plugins/auth.js';

type MediaType =
  | 'image'
  | 'background'
  | 'audio'
  | 'video'
  | 'page'
  | 'category'
  | 'author'
  | 'avatar'
  | 'presentation';

const MEDIA_BUCKET_MAP: Record<MediaType, string> = {
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

function parseBookId(request: { query?: any; headers?: any }) {
  const q = request?.query?.bookId != null ? String(request.query.bookId) : '';
  const h = request?.headers?.['x-book-id'] != null ? String(request.headers['x-book-id']) : '';
  const raw = q || h;
  if (!raw) return null;
  if (!/^\d+$/.test(raw)) return null;
  try {
    return BigInt(raw);
  } catch {
    return null;
  }
}

function normalizeRel(v: string) {
  return String(v || '')
    .replace(/\\/g, '/')
    .replace(/\0/g, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/g, '');
}

function assertSafeRelPath(rel: string) {
  const r = normalizeRel(rel);
  if (!r) return '';
  if (r.includes('..')) throw new Error('Caminho inválido.');
  return r;
}

function sanitizeFileName(name: string) {
  const base = path.posix.basename(String(name || '').replace(/\\/g, '/'));
  // remove chars problemáticos; mantém extensão
  return base
    .replace(/[^\w.\-() ]+/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 120);
}

function userFsBase(uid: string, root: string) {
  // root é relativo e vira parte do "filesystem" do usuário
  const safeRoot = assertSafeRelPath(root || 'library');
  return `${uid}/${safeRoot || 'library'}`;
}

function extType(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'webp', 'svg'].includes(ext)) return 'image';
  if (ext === 'gif') return 'gif';
  if (['mp3', 'wav', 'ogg'].includes(ext)) return 'audio';
  if (['mp4', 'webm', 'mov'].includes(ext)) return 'video';
  if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt'].includes(ext)) return 'document';
  return 'other';
}

export async function registerMediaRoutes(app: FastifyInstance) {
  /**
   * Lista arquivos/pastas dentro do filesystem do usuário.
   * O client trabalha com `path` relativo (sem uid).
   */
  app.get<{
    Querystring: { mediaType?: MediaType; path?: string; root?: string; bookId?: string; recursive?: string };
  }>('/media/list', { preHandler: requireCmsEditor }, async (request, reply) => {
    const mediaType = (request.query.mediaType || 'image') as MediaType;
    const bucket = MEDIA_BUCKET_MAP[mediaType] || MEDIA_BUCKET_MAP.image;
    try {
      assertBucket(bucket);
    } catch (e) {
      return reply.code(400).send({ error: (e as Error).message });
    }

    const uid = request.user!.id;
    const root = request.query.root || 'library';
    const relPath = request.query.path || '';
    const recursive = String(request.query.recursive || '').toLowerCase() === 'true';
    const bookId = parseBookId(request);

    let prefix: string;
    try {
      const effectiveRoot =
        bookId && root === 'library'
          ? `books/${bookId.toString()}`
          : root;
      const base = userFsBase(uid, effectiveRoot);
      const rel = assertSafeRelPath(relPath);
      prefix = rel ? `${base}/${rel}` : base;
    } catch (e) {
      return reply.code(400).send({ error: (e as Error).message });
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

    const effectiveRoot =
      bookId && root === 'library'
        ? `books/${bookId.toString()}`
        : root;
    const basePrefix = `${userFsBase(uid, effectiveRoot)}/`;
    const toRel = (full: string) =>
      full.startsWith(basePrefix) ? full.slice(basePrefix.length) : full;

    const folderItems = folders.map((f) => ({
      id: null,
      name: f.name,
      path: toRel(f.path),
      type: 'folder' as const,
      metadata: null,
      url: null,
    }));

    const fileItems = await Promise.all(
      files.map(async (file) => {
        const fullPath = file.fullPath;
        const type = extType(file.name);
        let url: string | null = null;
        try {
          // MinIO local normalmente não é público; então usamos URL assinada para tudo.
          url = await presignedGetUrl(bucket, fullPath, 3600);
        } catch {
          url = null;
        }
        const meta = metaByPath.get(fullPath);
        return {
          id: file.id,
          name: file.name,
          type,
          path: toRel(fullPath),
          url,
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
      }),
    );

    return reply.send({ data: [...folderItems, ...fileItems], error: null, bucket });
  });

  /**
   * URL assinada para uma chave já existente (ex.: imagens em pages_v2 após expirar presign do import).
   * Só devolve URL se a chave pertencer ao utilizador autenticado.
   */
  app.get<{
    Querystring: { bucket?: string; key?: string };
  }>('/media/signed-get', { preHandler: requireCmsEditor }, async (request, reply) => {
    const bucket = String(request.query.bucket || 'pages').trim();
    try {
      assertBucket(bucket);
    } catch (e) {
      return reply.code(400).send({ error: (e as Error).message });
    }
    const key = String(request.query.key || '').trim();
    const uid = request.user!.id;
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
    } catch (e) {
      return reply.code(500).send({ error: (e as Error).message || 'Falha ao assinar URL.' });
    }
  });

  /**
   * Upload (multipart) com key gerada pelo backend.
   * Client informa só `root` e `path` (pasta relativa); o arquivo vira um nome único.
   */
  app.post<{
    Querystring: { mediaType?: MediaType; root?: string; path?: string; bookId?: string };
  }>('/media/upload', { preHandler: requireCmsEditor }, async (request, reply) => {
    const mediaType = (request.query.mediaType || 'image') as MediaType;
    const bucket = MEDIA_BUCKET_MAP[mediaType] || MEDIA_BUCKET_MAP.image;
    try {
      assertBucket(bucket);
    } catch (e) {
      return reply.code(400).send({ error: (e as Error).message });
    }

    const uid = request.user!.id;
    const root = request.query.root || 'library';
    const relDirRaw = request.query.path || '';
    const bookId = parseBookId(request);

    let baseDir: string;
    try {
      // Se vier bookId, guardamos dentro de uma pasta por livro
      const effectiveRoot =
        bookId && root === 'library'
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
          if (parent && parent !== '.') baseDir = `${baseDir}/${parent}`;
        } else {
          baseDir = `${baseDir}/${relDir}`;
        }
      }
    } catch (e) {
      return reply.code(400).send({ error: (e as Error).message });
    }

    const parts = request.parts();
    let buf: Buffer | null = null;
    let ct = 'application/octet-stream';
    let originalName = '';

    for await (const part of parts) {
      if (part.type === 'file' && part.fieldname === 'file') {
        buf = await part.toBuffer();
        ct = part.mimetype || ct;
        originalName = part.filename || '';
      }
    }

    if (!buf) return reply.code(400).send({ error: 'Ficheiro em falta.' });

    const safeName = sanitizeFileName(originalName || 'file');
    const stamp = crypto.randomUUID();
    const key = `${baseDir}/${stamp}-${safeName}`;

    await putObject(bucket, key, buf, ct);

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
    } catch {
      /* metadados opcionais */
    }

    let url: string | null = null;
    try {
      url = await presignedGetUrl(bucket, key, 3600);
    } catch {
      url = null;
    }

    const effectiveRoot =
      bookId && root === 'library'
        ? `books/${bookId.toString()}`
        : root;
    const basePrefix = `${userFsBase(uid, effectiveRoot)}/`;
    const relPath = key.startsWith(basePrefix) ? key.slice(basePrefix.length) : key;

    return reply.send({ data: { path: relPath, url, name: safeName }, error: null, bucket });
  });

  /**
   * Substitui um arquivo existente mantendo o mesmo caminho.
   * Útil para "editar/substituir imagem" sem quebrar referências já salvas.
   */
  app.post<{
    Querystring: { mediaType?: MediaType; root?: string; path?: string; bookId?: string };
  }>('/media/replace', { preHandler: requireCmsEditor }, async (request, reply) => {
    const mediaType = (request.query.mediaType || 'image') as MediaType;
    const bucket = MEDIA_BUCKET_MAP[mediaType] || MEDIA_BUCKET_MAP.image;
    try {
      assertBucket(bucket);
    } catch (e) {
      return reply.code(400).send({ error: (e as Error).message });
    }

    const uid = request.user!.id;
    const root = request.query.root || 'library';
    const relPathRaw = request.query.path || '';
    const bookId = parseBookId(request);
    if (!relPathRaw) {
      return reply.code(400).send({ error: 'path obrigatório.' });
    }

    let key: string;
    try {
      const effectiveRoot =
        bookId && root === 'library'
          ? `books/${bookId.toString()}`
          : root;
      const base = userFsBase(uid, effectiveRoot);
      const rel = assertSafeRelPath(relPathRaw);
      if (!rel) return reply.code(400).send({ error: 'path inválido.' });
      key = `${base}/${rel}`;
    } catch (e) {
      return reply.code(400).send({ error: (e as Error).message });
    }

    const parts = request.parts();
    let buf: Buffer | null = null;
    let ct = 'application/octet-stream';
    for await (const part of parts) {
      if (part.type === 'file' && part.fieldname === 'file') {
        buf = await part.toBuffer();
        ct = part.mimetype || ct;
      }
    }
    if (!buf) return reply.code(400).send({ error: 'Ficheiro em falta.' });

    await putObject(bucket, key, buf, ct);
    const metadataUpdate = {
      fileName: path.posix.basename(key),
      fileType: ct,
      fileSize: BigInt(buf.length),
      updatedAt: new Date(),
    };
    const updated = await prisma.mediaFile.updateMany({
      where: { userId: uid, bucketName: bucket, filePath: key },
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

    let url: string | null = null;
    try {
      url = await presignedGetUrl(bucket, key, 3600);
    } catch {
      url = null;
    }

    return reply.send({
      data: { path: relPathRaw, url, name: path.posix.basename(key) },
      error: null,
      bucket,
    });
  });

  app.post<{ Body: { mediaType?: MediaType; root?: string; path?: string } }>(
    '/media/folder',
    { preHandler: requireCmsEditor },
    async (request, reply) => {
      const mediaType = (request.body?.mediaType || 'image') as MediaType;
      const bucket = MEDIA_BUCKET_MAP[mediaType] || MEDIA_BUCKET_MAP.image;
      try {
        assertBucket(bucket);
      } catch (e) {
        return reply.code(400).send({ error: (e as Error).message });
      }

      const uid = request.user!.id;
      const root = request.body?.root || 'library';
      const relFolder = request.body?.path || '';
      const bookId = parseBookId(request);
      let folderKey: string;
      try {
        const effectiveRoot =
          bookId && root === 'library'
            ? `books/${bookId.toString()}`
            : root;
        const base = userFsBase(uid, effectiveRoot);
        const rel = assertSafeRelPath(relFolder);
        folderKey = rel ? `${base}/${rel}` : base;
      } catch (e) {
        return reply.code(400).send({ error: (e as Error).message });
      }

      const key = `${folderKey}/.folder`;
      await putObject(bucket, key, Buffer.from('{}'), 'application/json');
      return reply.send({ ok: true });
    },
  );

  app.delete<{
    Querystring: { mediaType?: MediaType; root?: string; path?: string; bookId?: string };
  }>('/media/object', { preHandler: requireCmsEditor }, async (request, reply) => {
    const mediaType = (request.query.mediaType || 'image') as MediaType;
    const bucket = MEDIA_BUCKET_MAP[mediaType] || MEDIA_BUCKET_MAP.image;
    try {
      assertBucket(bucket);
    } catch (e) {
      return reply.code(400).send({ error: (e as Error).message });
    }
    const uid = request.user!.id;
    const root = request.query.root || 'library';
    const relPath = request.query.path || '';
    const bookId = parseBookId(request);
    if (!relPath) return reply.code(400).send({ error: 'path obrigatório.' });

    let key: string;
    try {
      const effectiveRoot =
        bookId && root === 'library'
          ? `books/${bookId.toString()}`
          : root;
      const base = userFsBase(uid, effectiveRoot);
      const rel = assertSafeRelPath(relPath);
      key = `${base}/${rel}`;
    } catch (e) {
      return reply.code(400).send({ error: (e as Error).message });
    }

    await deleteObject(bucket, key);
    await prisma.mediaFile.deleteMany({ where: { userId: uid, bucketName: bucket, filePath: key } });
    return reply.send({ ok: true });
  });

  app.post<{ Body: { mediaType?: MediaType; root?: string; from?: string; to?: string } }>(
    '/media/move',
    { preHandler: requireCmsEditor },
    async (request, reply) => {
      const mediaType = (request.body?.mediaType || 'image') as MediaType;
      const bucket = MEDIA_BUCKET_MAP[mediaType] || MEDIA_BUCKET_MAP.image;
      try {
        assertBucket(bucket);
      } catch (e) {
        return reply.code(400).send({ error: (e as Error).message });
      }
      const uid = request.user!.id;
      const root = request.body?.root || 'library';
      const bookId = parseBookId(request);
      const fromRel = request.body?.from || '';
      const toRel = request.body?.to || '';
      if (!fromRel || !toRel) return reply.code(400).send({ error: 'from e to obrigatórios.' });

      let fromKey: string;
      let toKey: string;
      try {
        const effectiveRoot =
          bookId && root === 'library'
            ? `books/${bookId.toString()}`
            : root;
        const base = userFsBase(uid, effectiveRoot);
        fromKey = `${base}/${assertSafeRelPath(fromRel)}`;
        toKey = `${base}/${assertSafeRelPath(toRel)}`;
      } catch (e) {
        return reply.code(400).send({ error: (e as Error).message });
      }

      await copyObject(bucket, fromKey, toKey);
      await deleteObject(bucket, fromKey);
      await prisma.mediaFile.updateMany({
        where: { userId: uid, bucketName: bucket, filePath: fromKey },
        data: { filePath: toKey, fileName: path.posix.basename(toKey) },
      });
      return reply.send({ ok: true });
    },
  );

  /**
   * Presign (para uploads diretos no storage).
   * Observação: o backend gera o key com base no usuário; o client nunca envia uid.
   */
  app.post<{
    Body: { mediaType?: MediaType; root?: string; path?: string; fileName?: string; contentType?: string };
  }>('/media/presign', { preHandler: requireCmsEditor }, async (request, reply) => {
    const mediaType = (request.body?.mediaType || 'image') as MediaType;
    const bucket = MEDIA_BUCKET_MAP[mediaType] || MEDIA_BUCKET_MAP.image;
    try {
      assertBucket(bucket);
    } catch (e) {
      return reply.code(400).send({ error: (e as Error).message });
    }
    const uid = request.user!.id;
    const root = request.body?.root || 'library';
    const bookId = parseBookId(request);
    const relDir = request.body?.path || '';
    const ct = request.body?.contentType || 'application/octet-stream';
    const safeName = sanitizeFileName(request.body?.fileName || 'file');

    let dirKey: string;
    try {
      const effectiveRoot =
        bookId && root === 'library'
          ? `books/${bookId.toString()}`
          : root;
      dirKey = userFsBase(uid, effectiveRoot);
      const rel = assertSafeRelPath(relDir);
      if (rel) dirKey = `${dirKey}/${rel}`;
    } catch (e) {
      return reply.code(400).send({ error: (e as Error).message });
    }

    const stamp = crypto.randomUUID();
    const key = `${dirKey}/${stamp}-${safeName}`;
    const putUrl = await presignedPutUrl(bucket, key, ct);
    const getUrl = await presignedGetUrl(bucket, key, 3600);

    const effectiveRoot =
      bookId && root === 'library'
        ? `books/${bookId.toString()}`
        : root;
    const basePrefix = `${userFsBase(uid, effectiveRoot)}/`;
    const relPath = key.startsWith(basePrefix) ? key.slice(basePrefix.length) : key;
    return reply.send({ data: { bucket, path: relPath, putUrl, url: getUrl, name: safeName } });
  });
}

