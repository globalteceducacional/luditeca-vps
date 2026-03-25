/**
 * Compatível com chamadas supabase.storage / supabase.from usadas em importPptxEngine.mjs
 */
import { PrismaClient } from '@prisma/client';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';

const prisma = new PrismaClient();

function getS3() {
  const endpoint = process.env.S3_ENDPOINT || process.env.MINIO_ENDPOINT;
  return new S3Client({
    region: process.env.S3_REGION || 'us-east-1',
    ...(endpoint
      ? {
          endpoint,
          forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
        }
      : {}),
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY || process.env.MINIO_ROOT_USER || '',
      secretAccessKey:
        process.env.S3_SECRET_KEY || process.env.MINIO_ROOT_PASSWORD || '',
    },
  });
}

function publicUrlFor(bucket, key) {
  const base = (process.env.PUBLIC_MEDIA_BASE || '').replace(/\/$/, '');
  const segments = [bucket, ...key.split('/').filter(Boolean)].map((s) =>
    encodeURIComponent(s),
  );
  const path = segments.join('/');
  if (!base) return `/${path}`;
  return `${base}/${path}`;
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export function createSupabaseLikeClient() {
  const s3 = getS3();

  return {
    storage: {
      from(bucket) {
        return {
          async upload(key, body, opts = {}) {
            let buf;
            if (Buffer.isBuffer(body)) buf = body;
            else if (body instanceof Uint8Array) buf = Buffer.from(body);
            else if (body?.arrayBuffer && typeof body.arrayBuffer === 'function')
              buf = Buffer.from(await body.arrayBuffer());
            else buf = Buffer.from(body);
            const ct =
              opts.contentType || 'application/octet-stream';
            await s3.send(
              new PutObjectCommand({
                Bucket: bucket,
                Key: key,
                Body: buf,
                ContentType: ct,
                CacheControl: opts.cacheControl || '3600',
              }),
            );
            return { data: null, error: null };
          },
          getPublicUrl(key) {
            return { data: { publicUrl: publicUrlFor(bucket, key) } };
          },
          async download(key) {
            try {
              const out = await s3.send(
                new GetObjectCommand({ Bucket: bucket, Key: key }),
              );
              const buf = await streamToBuffer(out.Body);
              return {
                data: {
                  async arrayBuffer() {
                    return buf.buffer.slice(
                      buf.byteOffset,
                      buf.byteOffset + buf.byteLength,
                    );
                  },
                },
                error: null,
              };
            } catch (e) {
              return { data: null, error: e };
            }
          },
          async remove(keys) {
            try {
              for (const key of keys) {
                await s3.send(
                  new DeleteObjectCommand({ Bucket: bucket, Key: key }),
                );
              }
              return { data: null, error: null };
            } catch (e) {
              return { data: null, error: e };
            }
          },
        };
      },
    },
    from(table) {
      return {
        async insert(row) {
          if (table !== 'media_files') {
            return { error: new Error(`Tabela não suportada: ${table}`) };
          }
          try {
            await prisma.mediaFile.create({
              data: {
                userId: row.user_id,
                filePath: row.file_path,
                fileName: row.file_name,
                fileType: row.file_type,
                fileSize: BigInt(row.file_size),
                bucketName: row.bucket_name,
                createdAt: row.created_at
                  ? new Date(row.created_at)
                  : new Date(),
              },
            });
            return { error: null };
          } catch (e) {
            return { error: e };
          }
        },
      };
    },
  };
}

export function buildStorageClient() {
  return createSupabaseLikeClient();
}
