import { apiFetch } from './apiClient';

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
    return {
      data: Array.isArray(row?.data) ? row.data : [],
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

export function getAppBook(id, view = 'v2') {
  const qs = view ? `?view=${encodeURIComponent(view)}` : '';
  return getApp(`/app/books/${id}${qs}`);
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
