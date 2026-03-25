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
import { requireAuth } from '../plugins/auth.js';

function extType(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'webp', 'svg'].includes(ext)) return 'image';
  if (ext === 'gif') return 'gif';
  if (['mp3', 'wav', 'ogg'].includes(ext)) return 'audio';
  if (['mp4', 'webm', 'mov'].includes(ext)) return 'video';
  if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt'].includes(ext)) return 'document';
  return 'other';
}

export async function registerStorageRoutes(app: FastifyInstance) {
  app.get<{ Params: { bucket: string }; Querystring: { prefix?: string } }>(
    '/storage/:bucket/list',
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        assertBucket(request.params.bucket);
      } catch (e) {
        return reply.code(400).send({ error: (e as Error).message });
      }
      const uid = request.user!.id;
      let prefix = (request.query.prefix ?? '').replace(/^\/+|\/+$/g, '');
      if (!prefix.startsWith(uid)) {
        prefix = prefix ? `${uid}/${prefix}` : uid;
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
          if (type === 'image' || type === 'gif') {
            url = publicUrl(request.params.bucket, fullPath);
          } else {
            try {
              url = await presignedGetUrl(request.params.bucket, fullPath, 3600);
            } catch {
              url = null;
            }
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
    { preHandler: requireAuth },
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
      if (!relPath.startsWith(uid)) {
        return reply.code(403).send({ error: 'Caminho não autorizado.' });
      }
      await putObject(request.params.bucket, relPath, buf, ct);
      try {
        await prisma.mediaFile.create({
          data: {
            userId: uid,
            filePath: relPath,
            fileName: relPath.split('/').pop() || relPath,
            fileType: ct,
            fileSize: BigInt(buf.length),
            bucketName: request.params.bucket,
          },
        });
      } catch {
        /* metadados opcionais */
      }
      const url = publicUrl(request.params.bucket, relPath);
      return reply.send({ data: { path: relPath, url }, error: null });
    },
  );

  app.delete<{ Params: { bucket: string }; Querystring: { path?: string } }>(
    '/storage/:bucket/object',
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        assertBucket(request.params.bucket);
      } catch (e) {
        return reply.code(400).send({ error: (e as Error).message });
      }
      const p = request.query.path;
      if (!p) return reply.code(400).send({ error: 'path obrigatório.' });
      const uid = request.user!.id;
      if (!p.startsWith(uid)) {
        return reply.code(403).send({ error: 'Caminho não autorizado.' });
      }
      await deleteObject(request.params.bucket, p);
      await prisma.mediaFile.deleteMany({
        where: { userId: uid, filePath: p, bucketName: request.params.bucket },
      });
      return reply.send({ ok: true });
    },
  );

  app.post<{ Params: { bucket: string } }>(
    '/storage/:bucket/folder',
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        assertBucket(request.params.bucket);
      } catch (e) {
        return reply.code(400).send({ error: (e as Error).message });
      }
      const body = request.body as { path?: string };
      const folderPath = body?.path?.replace(/\/$/, '') || '';
      const uid = request.user!.id;
      if (!folderPath.startsWith(uid)) {
        return reply.code(403).send({ error: 'Caminho não autorizado.' });
      }
      const key = `${folderPath}/.folder`;
      await putObject(request.params.bucket, key, Buffer.from('{}'), 'application/json');
      return reply.send({ ok: true, path: key });
    },
  );

  app.get<{ Params: { bucket: string }; Querystring: { path?: string } }>(
    '/storage/:bucket/metadata',
    { preHandler: requireAuth },
    async (request, reply) => {
      const p = request.query.path;
      if (!p) return reply.code(400).send({ error: 'path obrigatório.' });
      const row = await prisma.mediaFile.findFirst({
        where: {
          userId: request.user!.id,
          filePath: p,
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
    { preHandler: requireAuth },
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
      if (!from.startsWith(uid) || !to.startsWith(uid)) {
        return reply.code(403).send({ error: 'Caminhos não autorizados.' });
      }
      await copyObject(request.params.bucket, from, to);
      await deleteObject(request.params.bucket, from);
      await prisma.mediaFile.updateMany({
        where: {
          userId: uid,
          bucketName: request.params.bucket,
          filePath: from,
        },
        data: {
          filePath: to,
          fileName: to.split('/').pop() || to,
        },
      });
      return reply.send({ ok: true });
    },
  );
}
