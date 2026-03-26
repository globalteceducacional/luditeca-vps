import { apiFetch } from './apiClient';
import { normalizeCategory } from './apiNormalize';
import { sanitizeNumericFields } from './sanitizeNumeric';

export const getCategories = async () => {
  try {
    const rows = await apiFetch('/categories');
    return { data: rows.map(normalizeCategory), error: null };
  } catch (e) {
    return { data: null, error: { message: e.message } };
  }
};

export const getCategory = async (id) => {
  try {
    const row = await apiFetch(`/categories/${id}`);
    return { data: normalizeCategory(row), error: null };
  } catch (e) {
    return { data: null, error: { message: e.message } };
  }
};

export const createCategory = async (categoryData) => {
  try {
    const payload = sanitizeNumericFields({ ...categoryData });
    const row = await apiFetch('/categories', { method: 'POST', body: payload });
    return { data: normalizeCategory(row), error: null };
  } catch (e) {
    return { data: null, error: { message: e.message } };
  }
};

export const updateCategory = async (id, categoryData) => {
  try {
    const payload = sanitizeNumericFields({ ...categoryData });
    const row = await apiFetch(`/categories/${id}`, {
      method: 'PATCH',
      body: payload,
    });
    return { data: normalizeCategory(row), error: null };
  } catch (e) {
    return { data: null, error: { message: e.message } };
  }
};

export const deleteCategory = async (id) => {
  try {
    await apiFetch(`/categories/${id}`, { method: 'DELETE' });
    return { error: null };
  } catch (e) {
    return { error: { message: e.message } };
  }
};
