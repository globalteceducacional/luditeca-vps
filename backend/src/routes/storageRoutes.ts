import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import {
  assertBucket,
  copyObject,
  deleteObject,
  listObjects,
  presignedGetUrl,
  publicUrl,
  putObject,
} from '../lib/s3.js';
import { requireCmsEditor } from '../plugins/auth.js';

function extType(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'webp', 'svg'].includes(ext)) return 'image';
  if (ext === 'gif') return 'gif';
  if (['mp3', 'wav', 'ogg'].includes(ext)) return 'audio';
  if (['mp4', 'webm', 'mov'].includes(ext)) return 'video';
  if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt'].includes(ext)) return 'document';
  return 'other';
}

function normalizeKey(v: string) {
  return String(v || '')
    .replace(/\\/g, '/')
    .replace(/\0/g, '')
    .replace(/^\/+/, '');
}

function assertUserKey(uid: string, key: string) {
  const normalized = normalizeKey(key).replace(/\/+$/g, '');
  if (!normalized) throw new Error('Caminho inválido.');
  if (normalized.includes('..')) throw new Error('Caminho inválido.');
  if (!normalized.startsWith(`${uid}/`) && normalized !== uid) {
    throw new Error('Caminho não autorizado.');
  }
  return normalized;
}

export async function registerStorageRoutes(app: FastifyInstance) {
  app.get<{ Params: { bucket: string }; Querystring: { prefix?: string } }>(
    '/storage/:bucket/list',
    { preHandler: requireCmsEditor },
    async (request, reply) => {
      try {
        assertBucket(request.params.bucket);
      } catch (e) {
        return reply.code(400).send({ error: (e as Error).message });
      }
      const uid = request.user!.id;
      let prefix = normalizeKey(request.query.prefix ?? '').replace(/\/+$/g, '');
      if (!prefix) prefix = uid;
      if (!prefix.startsWith(`${uid}/`) && prefix !== uid) {
        prefix = `${uid}/${prefix}`;
      }
      try {
        prefix = assertUserKey(uid, prefix);
      } catch (e) {
        return reply.code(400).send({ error: (e as Error).message });
      }
      const { folders, files } = await listObjects(request.params.bucket, prefix);
      const metaRows = await prisma.mediaFile.findMany({
        where: {
          userId: uid,
          bucketName: request.params.bucket,
        },
      });
      const metaByPath = new Map(metaRows.map((m) => [m.filePath, m]));

      const folderItems = folders.map((f) => ({
        id: null,
        name: f.name,
        path: f.path,
        type: 'folder' as const,
        metadata: null,
      }));

      const fileItems = await Promise.all(
        files.map(async (file) => {
          const fullPath = file.fullPath;
          const type = extType(file.name);
          let url: string | null = null;
          try {
            // Por padrão, devolvemos URL assinada para tudo (mídia privada).
            url = await presignedGetUrl(request.params.bucket, fullPath, 3600);
          } catch {
            url = null;
          }
          const meta = metaByPath.get(fullPath);
          return {
            id: file.id,
            name: file.name,
            type,
            path: fullPath,
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

      return reply.send({ data: [...folderItems, ...fileItems], error: null });
    },
  );

  app.post<{ Params: { bucket: string } }>(
    '/storage/:bucket/upload',
    { preHandler: requireCmsEditor },
    async (request, reply) => {
      try {
        assertBucket(request.params.bucket);
      } catch (e) {
        return reply.code(400).send({ error: (e as Error).message });
      }
      let buf: Buffer | null = null;
      let ct = 'application/octet-stream';
      let relPath = '';
      const parts = request.parts();
      for await (const part of parts) {
        if (part.type === 'file' && part.fieldname === 'file') {
          buf = await part.toBuffer();
          ct = part.mimetype || ct;
        } else if (part.type === 'field' && part.fieldname === 'path') {
          relPath = String(part.value);
        }
      }
      if (!buf) {
        return reply.code(400).send({ error: 'Ficheiro em falta.' });
      }
      if (!relPath) {
        return reply.code(400).send({ error: 'path obrigatório.' });
      }
      const uid = request.user!.id;
      let key: string;
      try {
        key = assertUserKey(uid, relPath);
      } catch (e) {
        return reply.code(403).send({ error: (e as Error).message });
      }
      await putObject(request.params.bucket, key, buf, ct);
      try {
        await prisma.mediaFile.create({
          data: {
            userId: uid,
            filePath: key,
            fileName: key.split('/').pop() || key,
            fileType: ct,
            fileSize: BigInt(buf.length),
            bucketName: request.params.bucket,
          },
        });
      } catch {
        /* metadados opcionais */
      }
      let url: string | null = null;
      try {
        url = await presignedGetUrl(request.params.bucket, key, 3600);
      } catch {
        url = null;
      }
      return reply.send({ data: { path: key, url }, error: null });
    },
  );

  app.delete<{ Params: { bucket: string }; Querystring: { path?: string } }>(
    '/storage/:bucket/object',
    { preHandler: requireCmsEditor },
    async (request, reply) => {
      try {
        assertBucket(request.params.bucket);
      } catch (e) {
        return reply.code(400).send({ error: (e as Error).message });
      }
      const p = request.query.path;
      if (!p) return reply.code(400).send({ error: 'path obrigatório.' });
      const uid = request.user!.id;
      let key: string;
      try {
        key = assertUserKey(uid, p);
      } catch (e) {
        return reply.code(403).send({ error: (e as Error).message });
      }
      await deleteObject(request.params.bucket, key);
      await prisma.mediaFile.deleteMany({
        where: { userId: uid, filePath: key, bucketName: request.params.bucket },
      });
      return reply.send({ ok: true });
    },
  );

  app.post<{ Params: { bucket: string } }>(
    '/storage/:bucket/folder',
    { preHandler: requireCmsEditor },
    async (request, reply) => {
      try {
        assertBucket(request.params.bucket);
      } catch (e) {
        return reply.code(400).send({ error: (e as Error).message });
      }
      const body = request.body as { path?: string };
      const folderPath = body?.path?.replace(/\/$/, '') || '';
      const uid = request.user!.id;
      let normalizedFolder: string;
      try {
        normalizedFolder = assertUserKey(uid, folderPath);
      } catch (e) {
        return reply.code(403).send({ error: (e as Error).message });
      }
      const key = `${normalizedFolder}/.folder`;
      await putObject(request.params.bucket, key, Buffer.from('{}'), 'application/json');
      return reply.send({ ok: true, path: key });
    },
  );

  app.get<{ Params: { bucket: string }; Querystring: { path?: string } }>(
    '/storage/:bucket/metadata',
    { preHandler: requireCmsEditor },
    async (request, reply) => {
      try {
        assertBucket(request.params.bucket);
      } catch (e) {
        return reply.code(400).send({ error: (e as Error).message });
      }
      const p = request.query.path;
      if (!p) return reply.code(400).send({ error: 'path obrigatório.' });
      let key: string;
      try {
        key = assertUserKey(request.user!.id, p);
      } catch (e) {
        return reply.code(403).send({ error: (e as Error).message });
      }
      const row = await prisma.mediaFile.findFirst({
        where: {
          userId: request.user!.id,
          filePath: key,
          bucketName: request.params.bucket,
        },
      });
      if (!row) return reply.send(null);
      return reply.send({
        file_path: row.filePath,
        file_name: row.fileName,
        file_type: row.fileType,
        file_size: Number(row.fileSize),
        user_id: row.userId,
        created_at: row.createdAt.toISOString(),
      });
    },
  );

  app.post<{ Params: { bucket: string } }>(
    '/storage/:bucket/move',
    { preHandler: requireCmsEditor },
    async (request, reply) => {
      try {
        assertBucket(request.params.bucket);
      } catch (e) {
        return reply.code(400).send({ error: (e as Error).message });
      }
      const body = request.body as { from?: string; to?: string };
      const from = body?.from;
      const to = body?.to;
      if (!from || !to) {
        return reply.code(400).send({ error: 'from e to obrigatórios.' });
      }
      const uid = request.user!.id;
      let fromKey: string;
      let toKey: string;
      try {
        fromKey = assertUserKey(uid, from);
        toKey = assertUserKey(uid, to);
      } catch (e) {
        return reply.code(403).send({ error: (e as Error).message });
      }
      await copyObject(request.params.bucket, fromKey, toKey);
      await deleteObject(request.params.bucket, fromKey);
      await prisma.mediaFile.updateMany({
        where: {
          userId: uid,
          bucketName: request.params.bucket,
          filePath: fromKey,
        },
        data: {
          filePath: toKey,
          fileName: toKey.split('/').pop() || toKey,
        },
      });
      return reply.send({ ok: true });
    },
  );
}
