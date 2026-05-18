import { apiFetch } from './apiClient';

const toError = (e) =>
  (e && typeof e.message === 'string' && e.message) || 'Erro inesperado';

export async function listPuzzleGames(params = {}) {
  try {
    const q = new URLSearchParams();
    if (params.limit != null) q.set('limit', String(params.limit));
    if (params.offset != null) q.set('offset', String(params.offset));
    if (params.is_published != null) q.set('is_published', String(params.is_published));
    const qs = q.toString();
    const row = await apiFetch(qs ? `/puzzle-games?${qs}` : '/puzzle-games');
    return {
      data: Array.isArray(row?.data) ? row.data : [],
      total: row?.total ?? 0,
      error: null,
    };
  } catch (e) {
    return { data: null, total: 0, error: { message: toError(e) } };
  }
}

export async function createPuzzleGame(payload) {
  try {
    const row = await apiFetch('/puzzle-games', { method: 'POST', body: payload });
    return { data: row, error: null };
  } catch (e) {
    return { data: null, error: { message: toError(e) } };
  }
}

export async function updatePuzzleGame(id, payload) {
  try {
    const row = await apiFetch(`/puzzle-games/${id}`, { method: 'PATCH', body: payload });
    return { data: row, error: null };
  } catch (e) {
    return { data: null, error: { message: toError(e) } };
  }
}

export async function deletePuzzleGame(id) {
  try {
    await apiFetch(`/puzzle-games/${id}`, { method: 'DELETE' });
    return { error: null };
  } catch (e) {
    return { error: { message: toError(e) } };
  }
}
