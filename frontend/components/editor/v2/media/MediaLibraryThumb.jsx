import React from 'react';
import StorageBackedHtmlImage from '../../StorageBackedHtmlImage';
import GifFirstFrameThumb from './GifFirstFrameThumb';

function isGifNameOrUrl(name, url) {
  const n = String(name || '');
  const u = String(url || '');
  return /\.gif(?:$|[?#])/i.test(n) || /\.gif(?:$|[?#])/i.test(u);
}

/**
 * Miniatura da grelha da biblioteca: nunca reproduz GIF animado (usa `.thumb.png` ou 1.º frame).
 */
export default function MediaLibraryThumb({ item, previewUrl, storage, className, draggable = false }) {
  const hasServerThumb = Boolean(item?.thumbStorageKey || item?.thumbUrl);
  const gif = isGifNameOrUrl(item?.name, previewUrl);

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

  if (gif) {
    return <GifFirstFrameThumb src={previewUrl} storage={storage} className={className} alt="" />;
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
