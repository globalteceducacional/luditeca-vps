import { apiFetch } from './apiClient';

const toError = (e) =>
  (e && typeof e.message === 'string' && e.message) || 'Erro inesperado';

export async function listActivities(params = {}) {
  try {
    const q = new URLSearchParams();
    if (params.limit != null) q.set('limit', String(params.limit));
    if (params.offset != null) q.set('offset', String(params.offset));
    if (params.is_published != null) q.set('is_published', String(params.is_published));
    const qs = q.toString();
    const row = await apiFetch(qs ? `/activities?${qs}` : '/activities');
    return {
      data: Array.isArray(row?.data) ? row.data : [],
      total: row?.total ?? 0,
      error: null,
    };
  } catch (e) {
    return { data: null, total: 0, error: { message: toError(e) } };
  }
}

export async function getActivity(id) {
  try {
    const row = await apiFetch(`/activities/${id}`);
    return { data: row, error: null };
  } catch (e) {
    return { data: null, error: { message: toError(e) } };
  }
}

export async function createActivity(payload) {
  try {
    const row = await apiFetch('/activities', { method: 'POST', body: payload });
    return { data: row, error: null };
  } catch (e) {
    return { data: null, error: { message: toError(e) } };
  }
}

export async function updateActivity(id, payload) {
  try {
    const row = await apiFetch(`/activities/${id}`, { method: 'PATCH', body: payload });
    return { data: row, error: null };
  } catch (e) {
    return { data: null, error: { message: toError(e) } };
  }
}

export async function deleteActivity(id) {
  try {
    await apiFetch(`/activities/${id}`, { method: 'DELETE' });
    return { error: null };
  } catch (e) {
    return { error: { message: toError(e) } };
  }
}
