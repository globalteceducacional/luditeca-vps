import { apiFetch } from './apiClient';
import { normalizeAuthor } from './apiNormalize';
import { sanitizeNumericFields } from './sanitizeNumeric';

export const getAuthors = async () => {
  try {
    const rows = await apiFetch('/authors');
    return { data: rows.map(normalizeAuthor), error: null };
  } catch (e) {
    return { data: null, error: { message: e.message } };
  }
};

export const getAuthor = async (id) => {
  try {
    const row = await apiFetch(`/authors/${id}`);
    return { data: normalizeAuthor(row), error: null };
  } catch (e) {
    return { data: null, error: { message: e.message } };
  }
};

export const createAuthor = async (authorData) => {
  try {
    const payload = sanitizeNumericFields({ ...authorData });
    const row = await apiFetch('/authors', { method: 'POST', body: payload });
    return { data: normalizeAuthor(row), error: null };
  } catch (e) {
    return { data: null, error: { message: e.message } };
  }
};

export const updateAuthor = async (id, authorData) => {
  try {
    const payload = sanitizeNumericFields({ ...authorData });
    const row = await apiFetch(`/authors/${id}`, {
      method: 'PATCH',
      body: payload,
    });
    return { data: normalizeAuthor(row), error: null };
  } catch (e) {
    return { data: null, error: { message: e.message } };
  }
};

export const deleteAuthor = async (id) => {
  try {
    await apiFetch(`/authors/${id}`, { method: 'DELETE' });
    return { error: null };
  } catch (e) {
    return { error: { message: e.message } };
  }
};
