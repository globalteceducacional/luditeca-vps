import { apiFetch, getAccessToken, getApiBaseUrl } from './apiClient';

function toMediaTypeFromBucket(bucket) {
  const map = {
    covers: 'image',
    audios: 'audio',
    videos: 'video',
    pages: 'page',
    categories: 'category',
    autores: 'author',
    avatars: 'avatar',
    presentations: 'presentation',
  };
  return map[bucket] || 'image';
}

export async function storageList(bucket, prefix = '') {
  return storageListWithRoot(bucket, { path: prefix, root: 'library' });
}

export async function storageListWithRoot(bucket, { path = '', root = 'library', recursive = false, headers = {} } = {}) {
  // Compat: `prefix` agora é path relativo dentro do FS do usuário.
  const mediaType = toMediaTypeFromBucket(bucket);
  const q = `?mediaType=${encodeURIComponent(mediaType)}&path=${encodeURIComponent(path || '')}&root=${encodeURIComponent(root)}&recursive=${encodeURIComponent(recursive ? 'true' : 'false')}`;
  const res = await apiFetch(`/media/list${q}`, { headers });
  return res?.data ?? [];
}

export async function storageUpload(bucket, path, file) {
  return storageUploadWithRoot(bucket, { path, file, root: 'library' });
}

export async function storageUploadWithRoot(bucket, { path, file, root = 'library', headers = {} } = {}) {
  const base = getApiBaseUrl();
  const token = getAccessToken();
  const mediaType = toMediaTypeFromBucket(bucket);
  const form = new FormData();
  form.append('file', file);
  const mergedHeaders = { ...(headers || {}) };
  if (token) mergedHeaders.Authorization = `Bearer ${token}`;
  const res = await fetch(
    `${base}/media/upload?mediaType=${encodeURIComponent(mediaType)}&root=${encodeURIComponent(root)}&path=${encodeURIComponent(path || '')}`,
    {
      method: 'POST',
      headers: mergedHeaders,
      body: form,
    },
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error || `Upload falhou (${res.status})`);
  }
  return json.data;
}

/** Upload com progresso via XMLHttpRequest (0–100). */
export function storageUploadWithProgress(bucket, path, file, onProgress) {
  return storageUploadWithProgressAndRoot(bucket, { path, file, root: 'library', onProgress });
}

export function storageUploadWithProgressAndRoot(bucket, { path, file, root = 'library', onProgress, headers = {} } = {}) {
  const base = getApiBaseUrl();
  const token = getAccessToken();
  const mediaType = toMediaTypeFromBucket(bucket);
  const form = new FormData();
  form.append('file', file);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(
      'POST',
      `${base}/media/upload?mediaType=${encodeURIComponent(mediaType)}&root=${encodeURIComponent(root)}&path=${encodeURIComponent(path || '')}`,
    );
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    if (headers && typeof headers === 'object') {
      for (const [k, v] of Object.entries(headers)) {
        if (v != null) xhr.setRequestHeader(k, String(v));
      }
    }

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0 && onProgress) {
        const pct = Math.min(99, Math.round((e.loaded / e.total) * 100));
        onProgress(pct);
      }
    };

    xhr.onload = () => {
      try {
        const json = JSON.parse(xhr.responseText || '{}');
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(json.data);
        } else {
          reject(new Error(json.error || xhr.statusText));
        }
      } catch (err) {
        reject(err);
      }
    };
    xhr.onerror = () => reject(new Error('Erro de rede no upload.'));
    xhr.send(form);
  });
}

export async function storageReplaceWithRoot(
  bucket,
  { path, file, root = 'library', headers = {}, objectKey } = {},
) {
  const base = getApiBaseUrl();
  const token = getAccessToken();
  const mediaType = toMediaTypeFromBucket(bucket);
  const form = new FormData();
  form.append('file', file);
  const mergedHeaders = { ...(headers || {}) };
  if (token) mergedHeaders.Authorization = `Bearer ${token}`;

  const q = new URLSearchParams();
  q.set('mediaType', mediaType);
  q.set('root', root);
  const fullKey = typeof objectKey === 'string' && objectKey.trim() ? objectKey.trim() : '';
  if (fullKey) {
    q.set('key', fullKey);
  } else {
    q.set('path', path || '');
  }

  const res = await fetch(`${base}/media/replace?${q.toString()}`, {
    method: 'POST',
    headers: mergedHeaders,
    body: form,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error || `Substituição falhou (${res.status})`);
  }
  return json.data;
}

export async function storageDeleteObject(bucket, path) {
  return storageDeleteObjectWithRoot(bucket, { path, root: 'library' });
}

export async function storageDeleteObjectWithRoot(
  bucket,
  { path, root = 'library', headers = {}, objectKey } = {},
) {
  const mediaType = toMediaTypeFromBucket(bucket);
  const q = new URLSearchParams();
  q.set('mediaType', mediaType);
  q.set('root', root);
  const fullKey = typeof objectKey === 'string' && objectKey.trim() ? objectKey.trim() : '';
  if (fullKey) {
    q.set('key', fullKey);
  } else {
    q.set('path', path || '');
  }
  await apiFetch(`/media/object?${q.toString()}`, { method: 'DELETE', headers });
}

export async function storageCreateFolder(bucket, folderPath) {
  return storageCreateFolderWithRoot(bucket, { folderPath, root: 'library' });
}

export async function storageCreateFolderWithRoot(bucket, { folderPath, root = 'library', headers = {} } = {}) {
  const mediaType = toMediaTypeFromBucket(bucket);
  await apiFetch(`/media/folder`, {
    method: 'POST',
    headers,
    body: {
      mediaType,
      root,
      path: (folderPath || '').replace(/\/$/, ''),
    },
  });
}

export async function storageRenameWithRoot(
  bucket,
  { path, root = 'library', headers = {}, objectKey, fileName } = {},
) {
  const mediaType = toMediaTypeFromBucket(bucket);
  await apiFetch(`/media/rename`, {
    method: 'POST',
    headers,
    body: {
      mediaType,
      root,
      path: path || '',
      key: objectKey || '',
      fileName: fileName || '',
    },
  });
}

export async function storageMove(bucket, from, to) {
  return storageMoveWithRoot(bucket, { from, to, root: 'library' });
}

export async function storageMoveWithRoot(
  bucket,
  { from, to, root = 'library', headers = {}, objectFromKey, objectToKey } = {},
) {
  const mediaType = toMediaTypeFromBucket(bucket);
  const body = { mediaType, root };
  const fromKey = typeof objectFromKey === 'string' && objectFromKey.trim() ? objectFromKey.trim() : '';
  const toKey = typeof objectToKey === 'string' && objectToKey.trim() ? objectToKey.trim() : '';
  if (fromKey && toKey) {
    body.fromKey = fromKey;
    body.toKey = toKey;
  } else {
    body.from = from;
    body.to = to;
  }
  await apiFetch(`/media/move`, {
    method: 'POST',
    headers,
    body,
  });
}

export async function storageMetadata(bucket, path) {
  // Ainda não há endpoint dedicado /media/metadata. Por ora, retorna null para evitar chamadas extras.
  // A listagem já retorna metadata quando existir.
  void bucket;
  void path;
  return null;
}

/** URL assinada para leitura de um objeto já gravado (chave completa no bucket, ex.: uid/books/1/...). */
export async function storageSignedGetUrl(bucket, key, headers = {}) {
  const q = `?bucket=${encodeURIComponent(bucket)}&key=${encodeURIComponent(key)}`;
  const json = await apiFetch(`/media/signed-get${q}`, { headers });
  const url = json?.data?.url;
  return typeof url === 'string' && url ? url : null;
}

/** Mesma assinatura que o antigo uploadFile do Supabase (bucket + caminho + File). */
export async function uploadFile(bucketName, filePath, file) {
  const data = await storageUpload(bucketName, filePath, file);
  return { url: data.url, path: data.path };
}
