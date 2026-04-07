import React from 'react';
import StorageBackedHtmlImage from '../../StorageBackedHtmlImage';
import GifFirstFrameThumb from './GifFirstFrameThumb';

function isGifNameOrUrl(name, url) {
  const n = String(name || '');
  const u = String(url || '');
  return /\.gif(?:$|[?#])/i.test(n) || /\.gif(?:$|[?#])/i.test(u);
}

/**
 * Miniatura da grelha da biblioteca.
 * GIFs mostram só o 1.º frame (estático) — poupa CPU e largura de banda na grelha.
 * Imagens estáticas usam o thumbnail gerado pelo servidor quando disponível.
 */
export default function MediaLibraryThumb({ item, previewUrl, storage, className, draggable = false }) {
  const gif = isGifNameOrUrl(item?.name, previewUrl);

  // GIF: 1.º frame estático via GifFirstFrameThumb (evita N GIFs animando em simultâneo na grelha)
  if (gif) {
    return (
      <GifFirstFrameThumb
        src={previewUrl}
        storage={storage}
        className={className}
        alt=""
      />
    );
  }

  // Imagens estáticas: preferir thumbnail do servidor (mais leve)
  const hasServerThumb = Boolean(item?.thumbStorageKey || item?.thumbUrl);
  if (hasServerThumb) {
    const thumbStorage =
      typeof item.thumbStorageKey === 'string' && item.thumbStorageKey.trim()
        ? { bucket: (typeof item.bucket === 'string' && item.bucket.trim()) || 'pages', filePath: item.thumbStorageKey.trim() }
        : undefined;
    return (
      <StorageBackedHtmlImage
        src={String(item.thumbUrl || previewUrl || '')}
        storage={thumbStorage}
        alt=""
        className={className}
        draggable={draggable}
      />
    );
  }

  return (
    <StorageBackedHtmlImage
      src={previewUrl}
      storage={storage}
      alt=""
      className={className}
      draggable={draggable}
    />
  );
}
