import { useEffect, useMemo, useState } from 'react';
import { parseBookMediaStorage, resolveBookAssetUrl } from '../lib/bookMediaSrc';
import { storageSignedGetUrl } from '../lib/storageApi';

/**
 * URL para pré-visualização no CMS (resolve + renova via /media/signed-get se necessário).
 */
export function useBookAssetPreviewUrl(raw, bucket = 'pages') {
  const storage = useMemo(() => parseBookMediaStorage(raw, bucket), [raw, bucket]);
  const [src, setSrc] = useState(() => resolveBookAssetUrl(raw, bucket) || '');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    setSrc(resolveBookAssetUrl(raw, bucket) || '');
  }, [raw, bucket]);

  useEffect(() => {
    if (!storage?.filePath) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const signed = await storageSignedGetUrl(storage.bucket, storage.filePath);
        if (!cancelled && signed) setSrc(signed);
      } catch {
        /* mantém URL síncrona */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storage?.bucket, storage?.filePath]);

  const retrySigned = async () => {
    if (!storage?.filePath) return;
    try {
      const signed = await storageSignedGetUrl(storage.bucket, storage.filePath);
      if (signed) {
        setSrc(signed);
        setFailed(false);
      }
    } catch {
      setFailed(true);
    }
  };

  const onMediaError = () => {
    setFailed(true);
    retrySigned();
  };

  return { src, failed, onMediaError, storage };
}
