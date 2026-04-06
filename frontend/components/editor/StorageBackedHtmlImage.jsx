import React from 'react';
import { useResolvedStorageUrl } from '../../lib/useResolvedStorageUrl';

/**
 * Pré-visualização em HTML (&lt;img&gt;) com URL de storage renovada quando há `storage.filePath`.
 * Útil para GIF animado: o browser anima o GIF; Konva + use-image costuma mostrar só o 1.º frame.
 */
export default function StorageBackedHtmlImage({
  src,
  storage,
  alt = '',
  className = '',
  draggable = false,
  style,
}) {
  const resolved = useResolvedStorageUrl(String(src || ''), storage);
  if (!resolved) return null;
  return (
    <img src={resolved} alt={alt} className={className} draggable={draggable} style={style} />
  );
}
