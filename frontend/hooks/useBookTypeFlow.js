import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { toast } from 'react-hot-toast';
import { createBook, getBook, updateBook } from '../lib/books';
import { getAuthors } from '../lib/authors';
import { getCategories } from '../lib/categories';
import { uploadFile } from '../lib/storageApi';
import { useAuth } from '../contexts/auth';
import { CMS_ROLES, isRole } from '../lib/roles';
import { emptyQuizQuestion, normalizeQuizForApi } from '../lib/bookTypes';

export function emptyAnimatedPage(pageNumber = 1) {
  return {
    image_url: '',
    is_gif: false,
    text: '',
    page_type: 'reading',
    page_number: pageNumber,
  };
}

export function emptyInteractiveScene(sceneId = 'scene_1') {
  return {
    scene_id: sceneId,
    text: '',
    image_url: '',
    choices: [],
    is_start: false,
    is_ending: false,
  };
}

function mapBookToForm(data, bookType) {
  const pages = Array.isArray(data?.pages) ? data.pages : [];
  return {
    title: data?.title || '',
    description: data?.description || '',
    age_range: data?.age_range || '',
    author_id: data?.author_id || '',
    category_id: data?.category_id || '',
    cover_image: data?.cover_image || '',
    pages: pages.length
      ? pages
      : bookType === 'interactive'
        ? [emptyInteractiveScene()]
        : bookType === 'animated'
          ? []
          : [],
    quiz:
      Array.isArray(data?.quiz) && data.quiz.length
        ? data.quiz.map((q) => ({
            question: q.question || '',
            options: Array.isArray(q.options) && q.options.length === 4
              ? q.options
              : ['', '', '', ''],
            correct: Number(q.correct) || 0,
          }))
        : [emptyQuizQuestion()],
    soundtrack_url: data?.soundtrack_url || '',
    pdf_url: data?.pdf_url || '',
    epub_url: data?.epub_url || '',
    workflow_status: data?.workflow_status || 'draft',
  };
}

/**
 * Estado partilhado do fluxo por tipo (criar em /books/new/[type], editar em /books/[id]/edit-flow).
 */
export function useBookTypeFlow({ bookType, bookId = null }) {
  const isEdit = Boolean(bookId);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [form, setForm] = useState(() => ({
    title: '',
    description: '',
    age_range: '',
    author_id: '',
    category_id: '',
    cover_image: '',
    pages: bookType === 'interactive' ? [emptyInteractiveScene()] : [],
    quiz: [emptyQuizQuestion()],
    soundtrack_url: '',
    pdf_url: '',
    epub_url: '',
    workflow_status: 'draft',
  }));
  const [authors, setAuthors] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingBook, setLoadingBook] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const patchForm = useCallback((patch) => {
    setForm((prev) => ({ ...prev, ...patch }));
  }, []);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
    if (!authLoading && user && !isRole(user, CMS_ROLES)) router.replace('/app');
  }, [authLoading, user, router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingMeta(true);
      const [aRes, cRes] = await Promise.all([getAuthors(), getCategories()]);
      if (cancelled) return;
      if (!aRes.error) setAuthors(aRes.data || []);
      if (!cRes.error) setCategories(cRes.data || []);
      setLoadingMeta(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isEdit || !bookId) return;
    let cancelled = false;
    (async () => {
      setLoadingBook(true);
      const { data, error: err } = await getBook(bookId, { view: 'legacy' });
      if (cancelled) return;
      if (err) {
        setError(err.message);
        setLoadingBook(false);
        return;
      }
      if (data.book_type && data.book_type !== bookType) {
        setError('Este livro pertence a outro tipo editorial.');
        setLoadingBook(false);
        return;
      }
      setForm(mapBookToForm(data, bookType));
      setLoadingBook(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [isEdit, bookId, bookType]);

  const uploadMedia = async (file, bucket, pathPrefix = '') => {
    if (!file) throw new Error('Ficheiro inválido.');
    setUploading(true);
    try {
      const path = pathPrefix ? `${pathPrefix}/${file.name}` : file.name;
      const { url } = await uploadFile(bucket, path, file);
      if (!url) throw new Error('Upload sem URL.');
      return url;
    } finally {
      setUploading(false);
    }
  };

  const buildPayload = () => {
    const base = {
      title: form.title.trim(),
      description: form.description?.trim() || null,
      age_range: form.age_range?.trim() || null,
      author_id: form.author_id || null,
      category_id: form.category_id || null,
      cover_image: form.cover_image || null,
      workflow_status: form.workflow_status || 'draft',
      book_type: bookType,
    };

    if (bookType === 'digital') {
      return {
        ...base,
        pages: [],
        pdf_url: form.pdf_url || null,
        epub_url: form.epub_url || null,
        is_pdf: Boolean(form.pdf_url || form.epub_url),
      };
    }

    const quiz = normalizeQuizForApi(form.quiz);
    if (bookType === 'animated') {
      return {
        ...base,
        pages: form.pages,
        quiz,
        soundtrack_url: form.soundtrack_url || null,
      };
    }

    return {
      ...base,
      pages: form.pages,
      quiz,
    };
  };

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    setError(null);
    if (!form.title.trim()) {
      setError('O título é obrigatório.');
      return;
    }
    if (bookType === 'digital' && !form.pdf_url && !form.epub_url) {
      setError('Envie pelo menos um ficheiro PDF ou EPUB.');
      return;
    }
    if (bookType === 'animated' && (!Array.isArray(form.pages) || form.pages.length === 0)) {
      setError('Adicione pelo menos uma página.');
      return;
    }
    if (bookType === 'interactive') {
      const scenes = form.pages || [];
      if (!scenes.length) {
        setError('Adicione pelo menos uma cena.');
        return;
      }
      const ids = new Set(scenes.map((s) => s.scene_id));
      if (ids.size !== scenes.length) {
        setError('Cada cena precisa de um scene_id único.');
        return;
      }
    }

    setSaving(true);
    const payload = buildPayload();
    const result = isEdit
      ? await updateBook(bookId, payload)
      : await createBook(payload);
    setSaving(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    toast.success(isEdit ? 'Livro atualizado.' : 'Livro criado.');
    if (!isEdit && result.data?.id) {
      router.push(`/books/${result.data.id}/edit-flow`);
    }
  };

  return {
    user,
    authLoading,
    form,
    patchForm,
    setForm,
    authors,
    categories,
    loadingMeta,
    loadingBook,
    saving,
    uploading,
    uploadMedia,
    error,
    setError,
    handleSubmit,
    isEdit,
  };
}
