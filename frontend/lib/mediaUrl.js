/**
 * URL pública de ficheiro no armazenamento (alinhar com PUBLIC_MEDIA_BASE / nginx no servidor).
 */
export function getFileUrl(bucket, path) {
  const base = (process.env.NEXT_PUBLIC_MEDIA_BASE_URL || '').replace(/\/$/, '');
  const segments = [bucket, ...String(path).split('/').filter(Boolean)].map((s) =>
    encodeURIComponent(s),
  );
  const suffix = segments.join('/');
  if (!base) return `/${suffix}`;
  return `${base}/${suffix}`;
}
