import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import path from 'node:path';
import { promises as fs } from 'node:fs';

const STORAGE_DRIVER = (process.env.STORAGE_DRIVER || 'local').toLowerCase();
const LOCAL_STORAGE_DIR = path.resolve(
  process.env.LOCAL_STORAGE_DIR || path.join(process.cwd(), 'storage'),
);

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

function ensureSafeKey(key: string) {
  const normalized = String(key || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '');
  if (!normalized || normalized.includes('..')) {
    throw new Error('Caminho de storage inválido.');
  }
  return normalized;
}

function localObjectPath(bucket: string, key: string) {
  const safeKey = ensureSafeKey(key);
  return path.join(LOCAL_STORAGE_DIR, bucket, safeKey);
}

async function removeEmptyDirsUpwards(startDir: string, stopDir: string) {
  let current = path.resolve(startDir);
  const stop = path.resolve(stopDir);
  while (current.startsWith(stop) && current !== stop) {
    try {
      const entries = await fs.readdir(current);
      if (entries.length > 0) break;
      await fs.rmdir(current);
      current = path.dirname(current);
    } catch (e) {
      const err = e as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        current = path.dirname(current);
        continue;
      }
      break;
    }
  }
}

export function publicUrl(bucket: string, key: string) {
  const base = (process.env.PUBLIC_MEDIA_BASE || '/media').replace(/\/$/, '');
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
  if (STORAGE_DRIVER === 'local') {
    const absPath = localObjectPath(bucket, key);
    await fs.mkdir(path.dirname(absPath), { recursive: true });
    await fs.writeFile(absPath, body);
    return;
  }
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
  if (STORAGE_DRIVER === 'local') {
    const absPath = localObjectPath(bucket, key);
    const bucketRoot = path.join(LOCAL_STORAGE_DIR, bucket);
    try {
      await fs.unlink(absPath);
      await removeEmptyDirsUpwards(path.dirname(absPath), bucketRoot);
    } catch (e) {
      const err = e as NodeJS.ErrnoException;
      if (err.code !== 'ENOENT') throw e;
    }
    return;
  }
  await client().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

export async function copyObject(bucket: string, fromKey: string, toKey: string) {
  if (STORAGE_DRIVER === 'local') {
    const fromPath = localObjectPath(bucket, fromKey);
    const toPath = localObjectPath(bucket, toKey);
    await fs.mkdir(path.dirname(toPath), { recursive: true });
    await fs.copyFile(fromPath, toPath);
    return;
  }
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
  if (STORAGE_DRIVER === 'local') {
    const normalizedPrefix = prefix ? prefix.replace(/\/$/, '') : '';
    const baseDir = path.join(LOCAL_STORAGE_DIR, bucket, normalizedPrefix);
    try {
      const entries = await fs.readdir(baseDir, { withFileTypes: true });
      const folders: Array<{ name: string; path: string }> = [];
      const files: Array<{
        name: string;
        id: string;
        fullPath: string;
        size: number;
        updated_at: string;
      }> = [];

      for (const entry of entries) {
        const rel = normalizedPrefix ? `${normalizedPrefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          folders.push({ name: entry.name, path: rel });
          continue;
        }
        if (entry.name === '.folder') continue;
        const st = await fs.stat(path.join(baseDir, entry.name));
        files.push({
          name: entry.name,
          id: rel,
          fullPath: rel,
          size: st.size,
          updated_at: st.mtime.toISOString(),
        });
      }

      return { folders, files };
    } catch (e) {
      const err = e as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') return { folders: [], files: [] };
      throw e;
    }
  }
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

export async function listAllKeys(bucket: string, prefix: string) {
  if (STORAGE_DRIVER === 'local') {
    const normalizedPrefix = prefix ? prefix.replace(/\/$/, '') : '';
    const startDir = path.join(LOCAL_STORAGE_DIR, bucket, normalizedPrefix);
    const keys: string[] = [];

    async function walk(currentDir: string, currentRel: string) {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const nextRel = currentRel ? `${currentRel}/${entry.name}` : entry.name;
        const nextAbs = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          await walk(nextAbs, nextRel);
          continue;
        }
        if (entry.name === '.folder') continue;
        keys.push(nextRel);
      }
    }

    try {
      await walk(startDir, normalizedPrefix);
    } catch (e) {
      const err = e as NodeJS.ErrnoException;
      if (err.code !== 'ENOENT') throw e;
    }
    return keys;
  }
  const normalizedPrefix = prefix ? `${prefix.replace(/\/$/, '')}/` : '';
  const keys: string[] = [];
  let ContinuationToken: string | undefined;
  for (;;) {
    const out = await client().send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: normalizedPrefix || undefined,
        ContinuationToken,
      }),
    );
    for (const c of out.Contents || []) {
      if (!c.Key) continue;
      if (c.Key.endsWith('/')) continue;
      keys.push(c.Key);
    }
    if (!out.IsTruncated) break;
    ContinuationToken = out.NextContinuationToken;
    if (!ContinuationToken) break;
  }
  return keys;
}

export async function deletePrefix(bucket: string, prefix: string) {
  const keys = await listAllKeys(bucket, prefix);
  for (const key of keys) {
    await deleteObject(bucket, key);
  }
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
  if (STORAGE_DRIVER === 'local') {
    return publicUrl(bucket, key);
  }
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(client(), cmd, { expiresIn });
}

export function assertBucket(name: string) {
  if (!ALLOWED_BUCKETS.has(name)) {
    throw new Error(`Bucket não permitido: ${name}`);
  }
}

export async function presignedPutUrl(bucket: string, key: string, contentType: string) {
  if (STORAGE_DRIVER === 'local') {
    return publicUrl(bucket, key);
  }
  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(client(), cmd, { expiresIn: 3600 });
}
