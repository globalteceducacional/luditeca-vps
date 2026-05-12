/** Token JWT da API Luditeca (substitui sessão Supabase). */
const TOKEN_KEY = 'luditeca_access_token';

export function getApiBaseUrl() {
  const base = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
  if (!base && typeof window !== 'undefined') {
    console.warn('NEXT_PUBLIC_API_URL não definido.');
  }
  return base;
}

export function getAccessToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setAccessToken(token) {
  if (typeof window === 'undefined') return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function clearAccessToken() {
  setAccessToken(null);
}

/** Issue 04 — só comprime JSON quando o UTF-8 excede este tamanho (menos overhead). */
const GZIP_JSON_MIN_BYTES = 64 * 1024;

function utf8ByteLength(str) {
  try {
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(str).byteLength;
    }
  } catch {
    /* cai no Blob */
  }
  try {
    return new Blob([str]).size;
  } catch {
    return str.length;
  }
}

/**
 * Comprime o JSON com gzip no browser (CompressionStream) para reduzir upload
 * em PATCH/POST grandes. O backend descomprime em `preParsing` (server.ts).
 */
async function maybeCompressJsonBody(jsonString) {
  if (utf8ByteLength(jsonString) < GZIP_JSON_MIN_BYTES) {
    return { body: jsonString, headers: {} };
  }
  if (typeof CompressionStream === 'undefined') {
    return { body: jsonString, headers: {} };
  }
  try {
    const stream = new Blob([jsonString]).stream().pipeThrough(new CompressionStream('gzip'));
    const buf = await new Response(stream).arrayBuffer();
    return {
      body: buf,
      headers: { 'Content-Encoding': 'gzip' },
    };
  } catch {
    return { body: jsonString, headers: {} };
  }
}

/**
 * fetch à API com JSON e Bearer. `path` começa com / (ex: /books).
 */
export async function apiFetch(path, options = {}) {
  const base = getApiBaseUrl();
  if (!base) {
    throw new Error('Configure NEXT_PUBLIC_API_URL (ex.: http://localhost:3020 ou https://seu-dominio/api).');
  }
  const url = path.startsWith('http') ? path : `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = { ...(options.headers || {}) };
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let body = options.body;
  if (body != null && typeof body === 'object' && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    const jsonString = JSON.stringify(body);
    const zipped = await maybeCompressJsonBody(jsonString);
    body = zipped.body;
    Object.assign(headers, zipped.headers);
  }

  let res;
  try {
    res = await fetch(url, { ...options, headers, body });
  } catch (e) {
    const msg = e && typeof e.message === 'string' ? e.message : '';
    const looksNetwork =
      e instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(msg);
    if (looksNetwork) {
      throw new Error(
        `Sem ligação à API (${base}). Inicie o backend: na raiz do repo rode "npm install" uma vez e depois "npm run dev", ou noutro terminal "cd backend" e "npm run dev".`,
      );
    }
    throw e;
  }
  if (res.status === 204) return null;

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const msg =
      (data && typeof data === 'object' && data.error) || res.statusText || 'Pedido falhou';
    if (res.status === 401 && typeof window !== 'undefined') {
      clearAccessToken();
    }
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  return data;
}
