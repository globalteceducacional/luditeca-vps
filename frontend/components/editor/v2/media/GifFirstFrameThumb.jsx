import React, { useEffect, useState } from 'react';
import { FiImage } from 'react-icons/fi';
import { useResolvedStorageUrl } from '../../../../lib/useResolvedStorageUrl';

/**
 * Miniatura estática de GIF (1.º frame) via ImageDecoder, sem animação no DOM.
 * Reduz uso de CPU quando não há PNG `.thumb` do servidor. Fallback: ícone estático.
 */
export default function GifFirstFrameThumb({ src, storage, className = '', alt = '' }) {
  const url = useResolvedStorageUrl(String(src || ''), storage);
  const [png, setPng] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setPng(null);
    setFailed(false);
    if (!url) return () => {};

    (async () => {
      try {
        if (typeof ImageDecoder !== 'undefined') {
          const res = await fetch(url);
          if (!res.ok) throw new Error('fetch');
          const buf = await res.arrayBuffer();
          const dec = new ImageDecoder({ data: buf, type: 'image/gif' });
          const { image } = await dec.decode({ frameIndex: 0 });
          const c = document.createElement('canvas');
          c.width = image.displayWidth;
          c.height = image.displayHeight;
          const ctx = c.getContext('2d');
          if (ctx) {
            ctx.drawImage(image, 0, 0);
            image.close();
            if (!cancelled) setPng(c.toDataURL('image/png'));
            return;
          }
          image.close();
        }
      } catch {
        /* usar fallback */
      }
      if (!cancelled) setFailed(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [url]);

  if (png) {
    return <img src={png} alt={alt} className={className} draggable={false} />;
  }
  if (failed) {
    return (
      <div className={`flex items-center justify-center bg-slate-800 ${className}`}>
        <FiImage size={28} className="text-slate-500" aria-hidden />
      </div>
    );
  }
  return <div className={`min-h-0 min-w-0 animate-pulse bg-slate-800 ${className}`} aria-hidden />;
}
