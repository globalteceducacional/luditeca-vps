import { apiFetch } from './apiClient';
import { normalizeBook } from './apiNormalize';
import { sanitizeNumericFields } from './sanitizeNumeric';

export const getBooks = async () => {
  try {
    const rows = await apiFetch('/books');
    return { data: rows.map(normalizeBook), error: null };
  } catch (e) {
    return { data: null, error: { message: e.message } };
  }
};

export const getBook = async (id) => {
  try {
    const row = await apiFetch(`/books/${id}`);
    return { data: normalizeBook(row), error: null };
  } catch (e) {
    return { data: null, error: { message: e.message } };
  }
};

export const createBook = async (bookData) => {
  try {
    if (!bookData.title) {
      return {
        data: null,
        error: { message: 'O título do livro é obrigatório' },
      };
    }
    if (!bookData.pages || !Array.isArray(bookData.pages)) {
      bookData.pages = [
        {
          id: Date.now().toString(),
          background: '',
          elements: [],
          orientation: 'portrait',
        },
      ];
    }
    const payload = {
      title: bookData.title,
      author: bookData.author,
      description: bookData.description,
      cover_image: bookData.cover_image,
      pages: bookData.pages,
      pages_v2: bookData.pages_v2,
      author_id: bookData.author_id,
      category_id: bookData.category_id,
      link_slidebook: bookData.link_slidebook,
      import_session_id: bookData.import_session_id,
    };
    const row = await apiFetch('/books', { method: 'POST', body: payload });
    return { data: normalizeBook(row), error: null };
  } catch (e) {
    return { data: null, error: { message: e.message } };
  }
};

export const updateBook = async (id, bookData) => {
  try {
    const cleanBookData = { ...bookData };
    if (cleanBookData.authors) delete cleanBookData.authors;
    const sanitizedData = sanitizeNumericFields(cleanBookData);
    // Mantém compat: backend aceita pages_v2 / pagesV2. Padronizamos pages_v2.
    if (sanitizedData.pagesV2 && !sanitizedData.pages_v2) {
      sanitizedData.pages_v2 = sanitizedData.pagesV2;
      delete sanitizedData.pagesV2;
    }
    const dataSize = new Blob([JSON.stringify(sanitizedData)]).size;
    if (dataSize > 1000000) {
      return {
        data: null,
        error: {
          message: `Dados muito grandes (${Math.round((dataSize / 1024 / 1024) * 100) / 100}MB). Remova algumas imagens ou divida em mais livros.`,
        },
      };
    }
    const row = await apiFetch(`/books/${id}`, {
      method: 'PATCH',
      body: sanitizedData,
    });
    return { data: normalizeBook(row), error: null };
  } catch (e) {
    return { data: null, error: { message: e.message } };
  }
};

export const deleteBook = async (id) => {
  try {
    await apiFetch(`/books/${id}`, { method: 'DELETE' });
    return { error: null };
  } catch (e) {
    return { error: { message: e.message } };
  }
};
