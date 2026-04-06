import { useEffect, useState } from 'react';
import { storageSignedGetUrl } from './storageApi';

/**
 * Com `storage.filePath`, a URL em `content` pode ser presign expirado;
 * renova via API antes de usar em <video>, <img>, etc.
 */
export function useResolvedStorageUrl(url, storage) {
  const filePath = typeof storage?.filePath === 'string' ? storage.filePath.trim() : '';
  const bucket =
    typeof storage?.bucket === 'string' && storage.bucket.trim() ? storage.bucket.trim() : 'pages';
  const [resolved, setResolved] = useState(() => String(url || ''));
  useEffect(() => {
    const staticUrl = String(url || '');
    if (!filePath) {
      setResolved(staticUrl);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const signed = await storageSignedGetUrl(bucket, filePath);
        if (!cancelled) setResolved(signed || staticUrl);
      } catch {
        if (!cancelled) setResolved(staticUrl);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url, filePath, bucket]);
  return resolved;
}
