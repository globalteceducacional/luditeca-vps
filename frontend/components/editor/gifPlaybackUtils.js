/**
 * Deteção de GIF e regras para reprodução manual (velocidade / repetições).
 * A reprodução via <img> nativa não permite alterar velocidade nem número de ciclos.
 */

import { clamp, toNum } from '../../lib/editorUtils';

/** Ao importar/colocar um GIF no canvas (biblioteca, arrastar da grelha, etc.). */
export const DEFAULT_GIF_NODE_PROPS = Object.freeze({
  gifPlaybackSpeed: 1.05,
  gifInfiniteLoop: true,
  gifRepeatCount: 1,
});

/** URLs com extensão .gif visível (presign muitas vezes não tem). */
export function isLikelyAnimatedGifUrl(url) {
  return /\.gif(?:$|[?#])/i.test(String(url || '').trim());
}

export function isGifStoragePath(filePath) {
  const fp = String(filePath || '').trim();
  if (!fp) return false;
  const base = fp.split('/').pop() || fp;
  if (/\.gif$/i.test(base)) return true;
  return /\.gif(?:$|[?#])/i.test(fp);
}

/**
 * Deteta GIF animado: `mediaKind`, URL, `storage.filePath`, nome da biblioteca ou MIME.
 */
export function isAnimatedGifContent(url, storage, mediaKind, fileHint = null) {
  if (String(mediaKind || '').toLowerCase() === 'gif') return true;
  const hintMimeRaw =
    fileHint && typeof fileHint.mimeType === 'string' ? fileHint.mimeType.trim().toLowerCase() : '';
  if (hintMimeRaw === 'image/gif' || (hintMimeRaw.startsWith('image/') && hintMimeRaw.includes('gif'))) {
    return true;
  }
  const hintFt =
    fileHint && typeof fileHint.fileType === 'string' ? fileHint.fileType.trim().toLowerCase() : '';
  if (hintFt === 'image/gif' || (hintFt.startsWith('image/') && hintFt.includes('gif'))) return true;
  if (isLikelyAnimatedGifUrl(url)) return true;
  if (storage && isGifStoragePath(typeof storage?.filePath === 'string' ? storage.filePath : '')) {
    return true;
  }
  const hintName = fileHint && typeof fileHint.name === 'string' ? fileHint.name.trim() : '';
  if (hintName && /\.gif(?:$|[?#])/i.test(hintName)) return true;
  return false;
}

export function gifHintFromProps(props) {
  return {
    name: typeof props?.librarySourceName === 'string' ? props.librarySourceName : '',
    mimeType:
      typeof props?.mimeType === 'string'
        ? props.mimeType
        : typeof props?.contentType === 'string'
          ? props.contentType
          : '',
    fileType: typeof props?.fileType === 'string' ? props.fileType : '',
  };
}

/**
 * Quando `true`, usa decodificação frame-a-frame (gifuct-js) em vez de <img>.
 * Velocidade ≠ 1 ou repetição finita exige reprodução manual.
 */
export function needsManualGifPlayback(props, isGifNode) {
  if (!isGifNode) return false;
  const raw = clamp(toNum(props?.gifPlaybackSpeed, 1), 0.25, 4);
  const speed = Math.round(raw * 1000) / 1000;
  const infinite = props?.gifInfiniteLoop !== false;
  if (Math.abs(speed - 1) > 0.01) return true;
  if (!infinite) return true;
  return false;
}
