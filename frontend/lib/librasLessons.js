import { apiFetch } from './apiClient';

const toError = (e) =>
  (e && typeof e.message === 'string' && e.message) || 'Erro inesperado';

export async function listLibrasLessons(params = {}) {
  try {
    const q = new URLSearchParams();
    if (params.limit != null) q.set('limit', String(params.limit));
    if (params.offset != null) q.set('offset', String(params.offset));
    const qs = q.toString();
    const row = await apiFetch(qs ? `/libras-lessons?${qs}` : '/libras-lessons');
    return {
      data: Array.isArray(row?.data) ? row.data : [],
      total: row?.total ?? 0,
      error: null,
    };
  } catch (e) {
    return { data: null, total: 0, error: { message: toError(e) } };
  }
}

export async function getLibrasLesson(id) {
  try {
    const row = await apiFetch(`/libras-lessons/${id}`);
    return { data: row, error: null };
  } catch (e) {
    return { data: null, error: { message: toError(e) } };
  }
}

export async function createLibrasLesson(payload) {
  try {
    const row = await apiFetch('/libras-lessons', { method: 'POST', body: payload });
    return { data: row, error: null };
  } catch (e) {
    return { data: null, error: { message: toError(e) } };
  }
}

export async function updateLibrasLesson(id, payload) {
  try {
    const row = await apiFetch(`/libras-lessons/${id}`, { method: 'PATCH', body: payload });
    return { data: row, error: null };
  } catch (e) {
    return { data: null, error: { message: toError(e) } };
  }
}

export async function deleteLibrasLesson(id) {
  try {
    await apiFetch(`/libras-lessons/${id}`, { method: 'DELETE' });
    return { error: null };
  } catch (e) {
    return { error: { message: toError(e) } };
  }
}

export async function reorderLibrasLessons(ids) {
  try {
    await apiFetch('/libras-lessons/reorder', { method: 'PATCH', body: { ids } });
    return { error: null };
  } catch (e) {
    return { error: { message: toError(e) } };
  }
}
