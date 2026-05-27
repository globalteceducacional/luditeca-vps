import { getFileUrl, getMediaBaseUrl } from './mediaUrl';

/**
 * Buckets lógicos do fluxo de livros (paridade com backend `ALLOWED_BUCKETS`).
 */
export const BOOK_MEDIA_BUCKETS = {
  cover: 'covers',
  pages: 'pages',
  author: 'autores',
  category: 'categories',
};

/** Paridade com `backend/src/lib/s3.ts` — buckets válidos em `/media/{bucket}/...`. */
const KNOWN_MEDIA_BUCKETS = new Set([
  'covers',
  'pages',
  'presentations',
  'audios',
  'videos',
  'categories',
  'autores',
  'avatars',
]);

function splitPathSegments(value) {
  return String(value || '')
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean)
    .map((p) => {
      try {
        return decodeURIComponent(p);
      } catch {
        return p;
      }
    });
}

/**
 * Remove segmentos `media/` repetidos e devolve bucket + chave object storage.
 * Ex.: `media/pages/uid/library/file.gif` → `{ bucket: pages, filePath: uid/library/... }`
 */
export function peelBookMediaSegments(segments) {
  const parts = [...segments];
  while (parts.length > 0 && parts[0] === 'media') parts.shift();
  if (parts.length >= 2 && KNOWN_MEDIA_BUCKETS.has(parts[0])) {
    const bucket = parts[0];
    return { bucket, filePath: parts.slice(1).join('/') };
  }
  return null;
}

/**
 * Extrai bucket + filePath de URL absoluta, `/media/...` ou caminho relativo guardado no livro.
 */
export function parseBookMediaStorage(raw, defaultBucket = BOOK_MEDIA_BUCKETS.pages) {
  const s = String(raw || '').trim();
  if (!s) return null;

  const fromMediaPath = (pathname) => {
    const marker = '/media/';
    const idx = pathname.indexOf(marker);
    if (idx < 0) return null;
    const rest = pathname.slice(idx + marker.length);
    return peelBookMediaSegments(splitPathSegments(rest));
  };

  try {
    if (/^https?:\/\//i.test(s)) {
      const parsed = fromMediaPath(new URL(s).pathname);
      if (parsed) return parsed;
    }
  } catch {
    /* ignore */
  }

  if (s.startsWith('/media/')) {
    const parsed = fromMediaPath(s);
    if (parsed) return parsed;
  }

  const clean = s.replace(/^\/+/, '');
  if (clean && !clean.includes('://')) {
    const peeled = peelBookMediaSegments(splitPathSegments(clean));
    if (peeled) return peeled;
    if (clean.startsWith(`${defaultBucket}/`)) {
      return {
        bucket: defaultBucket,
        filePath: clean.slice(defaultBucket.length + 1),
      };
    }
    return { bucket: defaultBucket, filePath: clean };
  }

  return null;
}

/**
 * Resolve URL para `<img>`, `<audio>`, iframe PDF no CMS.
 */
export function resolveBookAssetUrl(url, bucket = BOOK_MEDIA_BUCKETS.pages) {
  if (!url) return null;
  const s = String(url).trim();
  if (!s) return null;

  const storage = parseBookMediaStorage(s, bucket);
  if (storage) {
    const built = getFileUrl(storage.bucket, storage.filePath);
    if (built) return built;
  }

  if (/^https?:\/\//i.test(s)) return s;

  return getFileUrl(bucket, s);
}

/** Corrige caminhos antigos (`book-animated/x.png`) para chave completa no storage. */
export function normalizeLegacyAssetPath(raw, { userId, root = 'library', bucket } = {}) {
  const value = String(raw || '').trim();
  if (!value) return value;
  if (/^https?:\/\//i.test(value)) {
    const storage = parseBookMediaStorage(value, bucket);
    return storage?.filePath || value;
  }
  const storage = parseBookMediaStorage(value, bucket);
  if (storage?.filePath?.includes('/library/')) return storage.filePath;
  if (userId && storage?.filePath?.startsWith(`${userId}/`)) return storage.filePath;
  return enrichStoragePath(storage?.filePath || value, { userId, root }) || value;
}

function enrichStoragePath(filePath, { userId, root = 'library' } = {}) {
  const rel = String(filePath || '').replace(/^\/+/, '');
  if (!rel) return null;
  if (userId && rel.startsWith(`${userId}/`)) return rel;
  if (rel.includes('/library/')) return rel;
  if (userId) {
    if (rel.startsWith(`${root}/`)) return `${userId}/${rel}`;
    return `${userId}/${root}/${rel}`;
  }
  return rel;
}

/**
 * Após upload: chave estável no bucket (ex.: `uid/library/book-animated/file.gif`).
 * Evita gravar URLs com `/media/` duplicado ou presign que expira.
 */
export function canonicalBookAssetUrl(
  uploadResult,
  bucket = BOOK_MEDIA_BUCKETS.pages,
  opts = {},
) {
  if (!uploadResult) return null;
  const candidates =
    typeof uploadResult === 'string'
      ? [uploadResult]
      : [
          uploadResult.url,
          uploadResult.image_url,
          uploadResult.path,
          uploadResult.filePath,
        ].filter(Boolean);

  // Preferir caminhos completos (com `uid/library/`) extraídos da URL presignada.
  for (const raw of candidates) {
    const storage = parseBookMediaStorage(raw, bucket);
    const fp = storage?.filePath;
    if (fp && (fp.includes('/library/') || (opts.userId && fp.startsWith(`${opts.userId}/`)))) {
      return fp;
    }
  }

  for (const raw of candidates) {
    const storage = parseBookMediaStorage(raw, bucket);
    if (storage?.filePath) {
      return enrichStoragePath(storage.filePath, opts);
    }
  }

  const fallback = candidates[0];
  return fallback ? enrichStoragePath(String(fallback), opts) : null;
}

export { getMediaBaseUrl };
