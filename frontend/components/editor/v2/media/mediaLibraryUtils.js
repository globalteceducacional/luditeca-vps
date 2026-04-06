function splitFileNameParts(name) {
  const clean = String(name || '').trim();
  const idx = clean.lastIndexOf('.');
  if (idx <= 0) return { stem: clean || 'arquivo', ext: '' };
  return { stem: clean.slice(0, idx), ext: clean.slice(idx) };
}

function sanitizeMediaNameStem(name) {
  return String(name || '')
    .trim()
    .replace(/[^\w.\-() ]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 100);
}

export function getAcceptFromMediaType(type) {
  if (type === 'video') return 'video/*,.mp4,.webm,.mov,.m4v';
  return type === 'audio'
    ? 'audio/*,.mp3,.wav,.ogg,.m4a'
    : 'image/*,image/gif,.gif,.webp,.png,.jpg,.jpeg';
}

export function libraryItemBusyKey(item) {
  const k = typeof item?.storageKey === 'string' ? item.storageKey.trim() : '';
  const p = typeof item?.path === 'string' ? item.path.trim() : '';
  return k || p || String(item?.id || '');
}

/**
 * Rótulo curto + variante visual para distinguir JPG, PNG, GIF, etc. na grelha da biblioteca.
 */
export function getLibraryMediaFormatBadge(item, { isAudio, isVideo, previewUrl } = {}) {
  const name = String(item?.name || '');
  const rawExt = splitFileNameParts(name).ext.replace(/^\./, '').toLowerCase();

  if (isAudio) {
    const e = rawExt || 'mp3';
    return { label: e.toUpperCase().slice(0, 5), variant: 'audio' };
  }
  if (isVideo) {
    const e = rawExt || 'mp4';
    return { label: e.toUpperCase().slice(0, 5), variant: 'video' };
  }
  if (rawExt === 'gif') return { label: 'GIF', variant: 'other' };
  if (rawExt === 'jpeg' || rawExt === 'jpg') return { label: 'JPG', variant: 'jpg' };
  if (rawExt === 'png') return { label: 'PNG', variant: 'png' };
  if (rawExt === 'webp') return { label: 'WEBP', variant: 'webp' };
  if (rawExt === 'svg') return { label: 'SVG', variant: 'svg' };
  if (rawExt === 'avif') return { label: 'AVIF', variant: 'avif' };
  if (rawExt === 'bmp') return { label: 'BMP', variant: 'bmp' };
  if (rawExt) return { label: rawExt.toUpperCase().slice(0, 5), variant: 'other' };

  const url = String(previewUrl || '');
  if (/\.gif(?:$|[?#])/i.test(url)) {
    return { label: 'GIF', variant: 'other' };
  }
  return { label: 'IMG', variant: 'generic' };
}

export function normalizeCropRect(rect) {
  const x = clampNum(rect?.x, 0, 99, 0);
  const y = clampNum(rect?.y, 0, 99, 0);
  const width = clampNum(rect?.width, 1, 100 - x, 100 - x);
  const height = clampNum(rect?.height, 1, 100 - y, 100 - y);
  return { x, y, width, height };
}

export function getItemObjectKey(item) {
  return typeof item?.storageKey === 'string' && item.storageKey.trim() ? item.storageKey.trim() : '';
}

export function buildRenamedFileName(item, nextStem) {
  const { ext } = splitFileNameParts(item?.name || '');
  const safeStem = sanitizeMediaNameStem(splitFileNameParts(nextStem).stem);
  if (!safeStem) return '';
  return `${safeStem}${ext}`;
}

export function mimeFromImageName(name) {
  const ext = splitFileNameParts(name).ext.toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  return 'image/jpeg';
}

export function clampNum(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export function normalizeImageAdjustments(raw) {
  return {
    brightness: clampNum(raw?.brightness, 0.2, 3, 1),
    contrast: clampNum(raw?.contrast, 0.2, 3, 1),
    saturation: clampNum(raw?.saturation, 0, 3, 1),
    rotation: clampNum(raw?.rotation, -180, 180, 0),
  };
}

export function imageCssFilter(adjustments) {
  const a = normalizeImageAdjustments(adjustments);
  return `brightness(${a.brightness}) contrast(${a.contrast}) saturate(${a.saturation})`;
}

export function hasImageAdjustmentsChanged(adjustments) {
  const a = normalizeImageAdjustments(adjustments);
  return (
    Math.abs(a.brightness - 1) > 0.001 ||
    Math.abs(a.contrast - 1) > 0.001 ||
    Math.abs(a.saturation - 1) > 0.001 ||
    Math.abs(a.rotation) > 0.001
  );
}

function mediaMetaMapStorageKey(bookId) {
  return `luditeca:editor:v2:media-meta:${String(bookId || '')}`;
}

export function readMediaMetaMap(bookId) {
  if (!bookId || typeof window === 'undefined') return {};
  const key = mediaMetaMapStorageKey(bookId);
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function writeMediaMetaMap(bookId, data) {
  if (!bookId || typeof window === 'undefined') return;
  const key = mediaMetaMapStorageKey(bookId);
  try {
    window.localStorage.setItem(key, JSON.stringify(data || {}));
  } catch {
    /* storage pode falhar em modo privado */
  }
}

export function initialRenameStem(name) {
  return splitFileNameParts(name || '').stem;
}
