import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

function client() {
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

export function publicUrl(bucket: string, key: string) {
  const base = (process.env.PUBLIC_MEDIA_BASE || '').replace(/\/$/, '');
  const segments = [bucket, ...key.split('/').filter(Boolean)].map((s) =>
    encodeURIComponent(s),
  );
  const path = segments.join('/');
  if (!base) return `/${path}`;
  return `${base}/${path}`;
}

export async function putObject(
  bucket: string,
  key: string,
  body: Buffer,
  contentType: string,
) {
  await client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: '3600',
    }),
  );
}

export async function deleteObject(bucket: string, key: string) {
  await client().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

export async function copyObject(bucket: string, fromKey: string, toKey: string) {
  const enc = (k: string) => encodeURIComponent(k).replace(/%2F/g, '/');
  await client().send(
    new CopyObjectCommand({
      Bucket: bucket,
      Key: toKey,
      CopySource: `${bucket}/${fromKey.split('/').map(enc).join('/')}`,
    }),
  );
}

export async function listObjects(bucket: string, prefix: string) {
  const out = await client().send(
    new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix ? `${prefix.replace(/\/$/, '')}/` : undefined,
      Delimiter: '/',
    }),
  );
  const folders =
    out.CommonPrefixes?.map((p) => {
      const full = (p.Prefix || '').replace(/\/$/, '');
      return {
        name: full.split('/').pop() || full,
        path: full,
      };
    }) || [];
  const files =
    out.Contents?.filter(
      (c) => c.Key && !c.Key.endsWith('/') && !c.Key.endsWith('/.folder'),
    ).map((c) => ({
      name: c.Key!.split('/').pop() || c.Key!,
      id: c.Key,
      fullPath: c.Key!,
      size: c.Size,
      updated_at: c.LastModified?.toISOString(),
    })) || [];
  return { folders, files };
}

const ALLOWED_BUCKETS = new Set([
  'covers',
  'pages',
  'presentations',
  'audios',
  'videos',
  'categories',
  'autores',
  'avatars',
]);

export async function presignedGetUrl(
  bucket: string,
  key: string,
  expiresIn = 3600,
) {
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(client(), cmd, { expiresIn });
}

export function assertBucket(name: string) {
  if (!ALLOWED_BUCKETS.has(name)) {
    throw new Error(`Bucket não permitido: ${name}`);
  }
}

export async function presignedPutUrl(bucket: string, key: string, contentType: string) {
  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(client(), cmd, { expiresIn: 3600 });
}
