import { apiFetch } from './apiClient';

export async function listUsers() {
  try {
    const data = await apiFetch('/users');
    return { data, error: null };
  } catch (e) {
    return { data: null, error: e };
  }
}

export async function createUser(payload) {
  try {
    const data = await apiFetch('/users', { method: 'POST', body: payload });
    return { data, error: null };
  } catch (e) {
    return { data: null, error: e };
  }
}

export async function updateUser(id, payload) {
  try {
    const data = await apiFetch(`/users/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload });
    return { data, error: null };
  } catch (e) {
    return { data: null, error: e };
  }
}

export async function deleteUser(id) {
  try {
    const data = await apiFetch(`/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
    return { data, error: null };
  } catch (e) {
    return { data: null, error: e };
  }
}

