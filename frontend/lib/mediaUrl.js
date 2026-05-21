import { getApiBaseUrl } from './apiClient';

/**
 * Base pública de ficheiros (`/media`). Usa NEXT_PUBLIC_MEDIA_BASE_URL ou API + /media.
 */
export function getMediaBaseUrl() {
  const explicit = (process.env.NEXT_PUBLIC_MEDIA_BASE_URL || '').replace(/\/$/, '');
  if (explicit) return explicit;
  const api = getApiBaseUrl();
  if (api) return `${api}/media`;
  return '';
}

/**
 * URL pública de ficheiro no armazenamento (local `storage/` ou proxy S3).
 */
export function getFileUrl(bucket, path) {
  const base = getMediaBaseUrl();
  const bucketSeg = encodeURIComponent(String(bucket || '').trim());
  let segments = String(path || '')
    .replace(/^\/+/, '')
    .split('/')
    .filter(Boolean);

  while (segments[0] === 'media') segments.shift();
  if (segments[0] === bucket) segments.shift();

  const rel = segments.map((s) => encodeURIComponent(s)).join('/');
  if (!bucketSeg || !rel) return base || null;
  const suffix = `${bucketSeg}/${rel}`;
  if (!base) return `/${suffix}`;
  return `${base}/${suffix}`;
}
