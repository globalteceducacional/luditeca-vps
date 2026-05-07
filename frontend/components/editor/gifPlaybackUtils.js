/**
 * Deteção de GIF e regras para reprodução manual (velocidade / repetições).
 *
 * Nota arquitetural — porque a reprodução é SEMPRE manual:
 *   1. Konva amostra o pixel buffer do source (`<img>`) no momento do `draw()`
 *      e não re-amostra a cada frame do GIF; sem orquestração externa, fica
 *      congelado no primeiro frame.
 *   2. O `<img>` host onde o browser animaria nativamente é montado com
 *      tamanho 2×2 px e opacity ≈ 0.02 (invisível); browsers modernos
 *      suspendem a animação de GIFs em elementos quase invisíveis para
 *      poupar CPU, deixando o GIF parado mesmo com `Konva.Animation` a
 *      forçar redraw.
 *   3. Decoder manual (gifuct-js) num `<canvas>` desenhado frame a frame
 *      via RAF é determinístico em todos os browsers e ainda permite
 *      controlar velocidade e número de repetições.
 */

/** Ao importar/colocar um GIF no canvas (biblioteca, arrastar da grelha, etc.). */
export const DEFAULT_GIF_NODE_PROPS = Object.freeze({
  gifPlaybackSpeed: 1,
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
 * Quando `true`, usa decodificação frame-a-frame (gifuct-js) num `<canvas>`
 * em vez de `<img>` nativo. Sempre `true` para GIFs: ver nota arquitetural
 * no topo deste ficheiro.
 *
 * O parâmetro `props` é mantido na assinatura para futura extensão (e.g.
 * desativar animação por opção do utilizador) sem partir os callers.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
export function needsManualGifPlayback(props, isGifNode) {
  return Boolean(isGifNode);
}
