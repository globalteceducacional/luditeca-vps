import { apiFetch } from './apiClient';
import { normalizeBook } from './apiNormalize';
import { sanitizeNumericFields } from './sanitizeNumeric';

const toErrorMessage = (error) => {
  if (typeof error === 'string') return error;
  if (error && typeof error.message === 'string' && error.message.trim() !== '') return error.message;
  return 'Erro inesperado ao processar a solicitação';
};

const isValidId = (id) => id !== null && id !== undefined && String(id).trim() !== '';

/**
 * Lista o catálogo de livros (cartões leves, sem `pages`/`pages_v2`).
 *
 * @param {{ limit?: number, offset?: number }} [params]
 * @returns {Promise<{ data: any[]|null, total: number, limit?: number, skip?: number, error: { message: string }|null }>}
 *
 * Retorno padronizado com `total` para suportar paginação na UI.
 * Compatível com versões anteriores da API que devolviam array puro.
 */
export const getBooks = async (params = {}) => {
  try {
    const q = new URLSearchParams();
    if (params.limit != null) q.set('limit', String(params.limit));
    if (params.offset != null) q.set('offset', String(params.offset));
    const qs = q.toString();
    const row = await apiFetch(qs ? `/books?${qs}` : '/books');

    // Compat: API antiga devolvia array puro.
    if (Array.isArray(row)) {
      const data = row.map(normalizeBook);
      return { data, total: data.length, limit: data.length, skip: 0, error: null };
    }

    return {
      data: Array.isArray(row?.data) ? row.data.map(normalizeBook) : [],
      total: typeof row?.total === 'number' ? row.total : 0,
      limit: row?.limit,
      skip: row?.skip,
      error: null,
    };
  } catch (e) {
    return { data: null, total: 0, error: { message: toErrorMessage(e) } };
  }
};

/**
 * Busca de catálogo (índice no servidor: título, descrição, autor, categoria, personagens, coleção, palavras-chave, nível).
 * @param {Record<string, string|number|undefined>} params q, character, collection, keyword, level, limit, offset
 */
export const searchBooks = async (params = {}) => {
  try {
    const q = new URLSearchParams();
    const keys = ['q', 'character', 'collection', 'keyword', 'level', 'limit', 'offset'];
    for (const k of keys) {
      const v = params[k];
      if (v != null && String(v).trim() !== '') q.set(k, String(v).trim());
    }
    const qs = q.toString();
    const row = await apiFetch(qs ? `/books/search?${qs}` : '/books/search');
    return {
      data: Array.isArray(row?.data) ? row.data.map(normalizeBook) : [],
      total: row?.total ?? 0,
      limit: row?.limit,
      skip: row?.skip,
      error: null,
    };
  } catch (e) {
    return { data: null, total: 0, error: { message: toErrorMessage(e) } };
  }
};

/**
 * Carrega um livro pelo id.
 *
 * @param {string|number} id
 * @param {{ view?: 'v2'|'legacy'|'both' }} [opts]
 *   - `view='v2'` (default): a API retorna apenas `pages_v2` hidratado e
 *     omite o `pages` legado quando há v2 — reduz drasticamente o payload
 *     e o número de presigns. Editor v2 só precisa de v2.
 *   - `view='legacy'`: força só `pages` legado.
 *   - `view='both'`: traz os dois (compatibilidade com clientes antigos).
 */
export const getBook = async (id, opts = {}) => {
  try {
    if (!isValidId(id)) {
      return { data: null, error: { message: 'ID do livro inválido' } };
    }
    const view = opts.view || 'v2';
    const qs = new URLSearchParams({ view }).toString();
    const row = await apiFetch(`/books/${id}?${qs}`);
    return { data: normalizeBook(row), error: null };
  } catch (e) {
    return { data: null, error: { message: toErrorMessage(e) } };
  }
};

export const createBook = async (bookData) => {
  try {
    if (!bookData || !bookData.title) {
      return {
        data: null,
        error: { message: 'O título do livro é obrigatório' },
      };
    }
    const fallbackPages = [
      {
        id: Date.now().toString(),
        background: '',
        elements: [],
        orientation: 'portrait',
      },
    ];
    const useTypeFlow = Boolean(bookData.book_type);
    const payload = sanitizeNumericFields({
      title: bookData.title,
      author: bookData.author,
      description: bookData.description,
      cover_image: bookData.cover_image,
      pages: useTypeFlow
        ? Array.isArray(bookData.pages)
          ? bookData.pages
          : []
        : Array.isArray(bookData.pages)
          ? bookData.pages
          : fallbackPages,
      pages_v2: bookData.pages_v2,
      author_id: bookData.author_id,
      category_id: bookData.category_id,
      link_slidebook: bookData.link_slidebook,
      import_session_id: bookData.import_session_id,
      ...(bookData.workflow_status ? { workflow_status: bookData.workflow_status } : {}),
      ...(bookData.book_type ? { book_type: bookData.book_type } : {}),
      ...(bookData.age_range != null ? { age_range: bookData.age_range } : {}),
      ...(bookData.quiz != null ? { quiz: bookData.quiz } : {}),
      ...(bookData.soundtrack_url != null ? { soundtrack_url: bookData.soundtrack_url } : {}),
      ...(bookData.pdf_url != null ? { pdf_url: bookData.pdf_url } : {}),
      ...(bookData.epub_url != null ? { epub_url: bookData.epub_url } : {}),
      ...(bookData.is_pdf != null ? { is_pdf: bookData.is_pdf } : {}),
    });
    const row = await apiFetch('/books', { method: 'POST', body: payload });
    return { data: normalizeBook(row), error: null };
  } catch (e) {
    return { data: null, error: { message: toErrorMessage(e) } };
  }
};

export const updateBook = async (id, bookData) => {
  try {
    if (!isValidId(id)) {
      return { data: null, error: { message: 'ID do livro inválido' } };
    }
    const cleanBookData = { ...bookData };
    if (cleanBookData.authors) delete cleanBookData.authors;
    const sanitizedData = sanitizeNumericFields(cleanBookData);
    // Mantém compat: backend aceita pages_v2 / pagesV2. Padronizamos pages_v2.
    if (sanitizedData.pagesV2 && !sanitizedData.pages_v2) {
      sanitizedData.pages_v2 = sanitizedData.pagesV2;
      delete sanitizedData.pagesV2;
    }
    // Issue 04 — limite de 1 MB removido. O backend aceita até 600 MB
    // (`bodyLimit` em server.ts) e responde comprimido (@fastify/compress).
    // Acima de 5 MB emitimos um warn em dev para flaggar livros que provavelmente
    // beneficiam da migração para `book_pages`/`book_page_nodes` (Issue 05,
    // Sprint 4). Não bloqueamos: o utilizador final não deve perder trabalho.
    if (typeof window !== 'undefined') {
      const dataSize = new Blob([JSON.stringify(sanitizedData)]).size;
      if (dataSize > 5 * 1024 * 1024) {
        // eslint-disable-next-line no-console
        console.warn(
          `[updateBook] payload grande: ${(dataSize / 1024 / 1024).toFixed(2)} MB. ` +
            'Considera dividir o livro ou esperar pela migração para tabelas relacionais (Issue 05).',
        );
      }
    }
    const row = await apiFetch(`/books/${id}`, {
      method: 'PATCH',
      body: sanitizedData,
    });
    return { data: normalizeBook(row), error: null };
  } catch (e) {
    return { data: null, error: { message: toErrorMessage(e) } };
  }
};

export const deleteBook = async (id) => {
  try {
    if (!isValidId(id)) {
      return { error: { message: 'ID do livro inválido' } };
    }
    await apiFetch(`/books/${id}`, { method: 'DELETE' });
    return { error: null };
  } catch (e) {
    return { error: { message: toErrorMessage(e) } };
  }
};
