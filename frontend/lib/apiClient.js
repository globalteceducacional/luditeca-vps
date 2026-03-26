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

/**
 * fetch à API com JSON e Bearer. `path` começa com / (ex: /books).
 */
export async function apiFetch(path, options = {}) {
  const base = getApiBaseUrl();
  if (!base) {
    throw new Error('Configure NEXT_PUBLIC_API_URL (ex.: http://localhost:4000 ou https://seu-dominio/api).');
  }
  const url = path.startsWith('http') ? path : `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = { ...(options.headers || {}) };
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let body = options.body;
  if (body != null && typeof body === 'object' && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }

  const res = await fetch(url, { ...options, headers, body });
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
