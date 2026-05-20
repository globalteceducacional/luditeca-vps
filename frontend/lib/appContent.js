import { apiFetch } from './apiClient';
import { normalizeBook } from './apiNormalize';

const toError = (e) =>
  (e && typeof e.message === 'string' && e.message) || 'Erro inesperado';

function buildQuery(params = {}) {
  const q = new URLSearchParams();
  if (params.limit != null) q.set('limit', String(params.limit));
  if (params.offset != null) q.set('offset', String(params.offset));
  return q.toString();
}

async function listApp(path, params = {}) {
  try {
    const qs = buildQuery(params);
    const row = await apiFetch(qs ? `${path}?${qs}` : path);
    const raw = Array.isArray(row?.data) ? row.data : [];
    return {
      data: path.startsWith('/app/books') ? raw.map(normalizeAppBookCard) : raw,
      total: row?.total ?? 0,
      error: null,
    };
  } catch (e) {
    return { data: null, total: 0, error: { message: toError(e) } };
  }
}

async function getApp(path) {
  try {
    const row = await apiFetch(path);
    return { data: row, error: null };
  } catch (e) {
    return { data: null, error: { message: toError(e) } };
  }
}

export function listAppBooks(params) {
  return listApp('/app/books', params);
}

/**
 * Detalhe de livro publicado na app.
 * @param {string|number} id
 * @param {'v2'|'legacy'|'both'} [view] — use `both` para livros por tipo (`book_type` + legado).
 */
export async function getAppBook(id, view = 'both') {
  const qs = view ? `?view=${encodeURIComponent(view)}` : '';
  const res = await getApp(`/app/books/${id}${qs}`);
  if (res.error || !res.data) return res;
  return { data: normalizeBook(res.data), error: null };
}

export function normalizeAppBookCard(row) {
  return normalizeBook(row);
}

export function listAppActivities(params) {
  return listApp('/app/activities', params);
}

export function getAppActivity(id) {
  return getApp(`/app/activities/${id}`);
}

export function listAppLibrasLessons(params) {
  return listApp('/app/libras-lessons', params);
}

export function listAppPuzzleGames(params) {
  return listApp('/app/puzzle-games', params);
}

export function listAppColoringPages(params) {
  return listApp('/app/coloring-pages', params);
}
