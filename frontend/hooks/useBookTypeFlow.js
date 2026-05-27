import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { toast } from 'react-hot-toast';
import { createBook, getBook, updateBook } from '../lib/books';
import { getAuthors } from '../lib/authors';
import { getCategories } from '../lib/categories';
import { uploadFile } from '../lib/storageApi';
import { useAuth } from '../contexts/auth';
import { CMS_ROLES, isRole } from '../lib/roles';
import { canonicalBookAssetUrl, normalizeLegacyAssetPath } from '../lib/bookMediaSrc';
import { normalizeQuizForApi } from '../lib/bookTypes';
import {
  isQuizTimelineItem,
  splitTimelineForApi,
  timelineFromBook,
} from '../lib/bookContentTimeline';
import { emptyAdventurePage } from '../lib/interactiveAdventure';
import { validateInteractiveScenesClient } from '../lib/interactiveScenes';

export function emptyAnimatedPage(pageNumber = 1) {
  return {
    image_url: '',
    is_gif: false,
    text: '',
    page_type: 'reading',
    page_number: pageNumber,
  };
}

export function emptyInteractiveScene(
  pageId = null,
  { isFirst = false, isEnding = false, endingType = null } = {},
) {
  const id = Number(pageId) > 0 ? Number(pageId) : 1;
  return emptyAdventurePage(id, { isFirst, isEnding, endingType });
}

function normalizeFormAssets(formSlice, bookType, userId) {
  if (!userId) return formSlice;
  const enrich = (raw, bucket) =>
    normalizeLegacyAssetPath(raw, { userId, root: 'library', bucket });

  const next = { ...formSlice };
  if (next.cover_image) next.cover_image = enrich(next.cover_image, 'covers');
  if (next.soundtrack_url) next.soundtrack_url = enrich(next.soundtrack_url, 'pages');
  if (next.pdf_url) next.pdf_url = enrich(next.pdf_url, 'pages');
  if (next.epub_url) next.epub_url = enrich(next.epub_url, 'pages');

  if (Array.isArray(next.pages)) {
    next.pages = next.pages.map((item) => {
      const row = { ...item };
      if (row.image_url) row.image_url = enrich(row.image_url, 'pages');
      return row;
    });
  }
  return next;
}

function mapBookToForm(data, bookType, userId = null) {
  const timeline = timelineFromBook(data, bookType);

  return normalizeFormAssets(
    {
      title: data?.title || '',
      description: data?.description || '',
      age_range: data?.age_range || '',
      author_id: data?.author_id || '',
      category_id: data?.category_id || '',
      cover_image: data?.cover_image || '',
      pages: timeline,
      quiz: [],
      soundtrack_url: data?.soundtrack_url || '',
      pdf_url: data?.pdf_url || '',
      epub_url: data?.epub_url || '',
      workflow_status: data?.workflow_status || 'draft',
    },
    bookType,
    userId,
  );
}

function isPublishedStatus(status) {
  return String(status || '').trim().toLowerCase() === 'published';
}

/**
 * Estado partilhado do fluxo por tipo (criar em /books/new/[type], editar em /books/[id]/edit-flow).
 */
export function useBookTypeFlow({ bookType, bookId = null }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [activeBookId, setActiveBookId] = useState(bookId ? String(bookId) : null);
  const isEdit = Boolean(activeBookId);
  const [step, setStep] = useState(0);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const autosaveSkipRef = useRef(true);
  const [form, setForm] = useState(() => ({
    title: '',
    description: '',
    age_range: '',
    author_id: '',
    category_id: '',
    cover_image: '',
    pages:
      bookType === 'interactive'
        ? (() => {
            const page2 = emptyInteractiveScene(2, { isEnding: true, endingType: 'neutral' });
            const page1 = {
              ...emptyInteractiveScene(1, { isFirst: true }),
              choices: [
                {
                  label: '',
                  target_page_id: 2,
                  target_scene_id: '2',
                  conditions: null,
                  effects: null,
                },
              ],
            };
            return [page1, page2];
          })()
        : [],
    quiz: [],
    soundtrack_url: '',
    pdf_url: '',
    epub_url: '',
    workflow_status: 'draft',
  }));
  const [authors, setAuthors] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingBook, setLoadingBook] = useState(Boolean(bookId));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [error, setError] = useState(null);
  const [publishModalOpen, setPublishModalOpen] = useState(false);

  const patchForm = useCallback((patch) => {
    setForm((prev) => ({ ...prev, ...patch }));
  }, []);

  const sortByName = (list) =>
    [...list].sort((a, b) =>
      String(a.name || '').localeCompare(String(b.name || ''), 'pt', { sensitivity: 'base' }),
    );

  const onAuthorCreated = useCallback(
    (author) => {
      setAuthors((prev) => {
        const without = prev.filter((a) => String(a.id) !== String(author.id));
        return sortByName([...without, author]);
      });
      patchForm({ author_id: String(author.id) });
    },
    [patchForm],
  );

  const onCategoryCreated = useCallback(
    (category) => {
      setCategories((prev) => {
        const without = prev.filter((c) => String(c.id) !== String(category.id));
        return sortByName([...without, category]);
      });
      patchForm({ category_id: String(category.id) });
    },
    [patchForm],
  );

  useEffect(() => {
    if (bookId) setActiveBookId(String(bookId));
  }, [bookId]);

  useEffect(() => {
    const raw = router.query?.step;
    if (raw === undefined || raw === '') return;
    const n = parseInt(String(raw), 10);
    if (Number.isFinite(n) && n >= 0 && n <= 2) setStep(n);
  }, [router.query?.step]);

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
    if (!activeBookId) return;
    let cancelled = false;
    (async () => {
      setLoadingBook(true);
      const { data, error: err } = await getBook(activeBookId, { view: 'legacy' });
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
      setForm(mapBookToForm(data, bookType, user?.id));
      setLoadingBook(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeBookId, bookType]);

  const uploadMedia = async (file, bucket, pathPrefix = '', progressOpts = null) => {
    if (!file) throw new Error('Ficheiro inválido.');
    setUploading(true);
    if (progressOpts) {
      setUploadProgress({
        current: progressOpts.current ?? 0,
        total: progressOpts.total ?? 1,
        label: progressOpts.label || 'A enviar ficheiros…',
      });
    }
    try {
      const path = pathPrefix ? `${pathPrefix}/${file.name}` : file.name;
      const uploaded = await uploadFile(bucket, path, file);
      const canonical = canonicalBookAssetUrl(uploaded, bucket, {
        userId: user?.id,
        root: 'library',
      });
      if (!canonical) throw new Error('Upload sem URL.');
      return canonical;
    } finally {
      if (!progressOpts || progressOpts.current >= progressOpts.total) {
        setUploading(false);
        setUploadProgress(null);
      }
    }
  };

  const buildPayload = (workflowStatusOverride) => {
    const wf = workflowStatusOverride ?? (form.workflow_status || 'draft');
    const { pages, quiz } =
      bookType === 'digital'
        ? { pages: [], quiz: [] }
        : splitTimelineForApi(form.pages, bookType);

    const base = {
      title: form.title.trim(),
      description: form.description?.trim() || null,
      age_range: form.age_range?.trim() || null,
      author_id: form.author_id || null,
      category_id: form.category_id || null,
      cover_image: form.cover_image || null,
      workflow_status: wf,
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

    if (bookType === 'animated') {
      return {
        ...base,
        pages,
        quiz,
        soundtrack_url: form.soundtrack_url || null,
      };
    }

    return {
      ...base,
      pages,
      quiz,
    };
  };

  const validateForSave = ({ publishing = false } = {}) => {
    if (!form.title.trim()) {
      return 'O título é obrigatório.';
    }

    const strict = publishing || isPublishedStatus(form.workflow_status);

    if (bookType === 'digital') {
      if (strict && !form.pdf_url && !form.epub_url) {
        return 'Envie pelo menos um ficheiro PDF ou EPUB para publicar.';
      }
      return null;
    }

    if (bookType === 'interactive') {
      const check = validateInteractiveScenesClient(form.pages, { requireContent: strict });
      if (!check.ok) return check.error;
      if (strict) {
        const list = Array.isArray(form.pages) ? form.pages : [];
        for (let i = 0; i < list.length; i += 1) {
          if (!isQuizTimelineItem(list[i])) continue;
          const q = normalizeQuizForApi([list[i]]);
          if (!q.length) return `A pergunta na posição ${i + 1} está incompleta.`;
        }
      }
      return null;
    }

    if (bookType === 'animated') {
      const list = Array.isArray(form.pages) ? form.pages : [];
      if (strict) {
        const hasReading = list.some((p) => !isQuizTimelineItem(p));
        if (!hasReading) return 'Adicione pelo menos uma página de leitura para publicar.';
        for (let i = 0; i < list.length; i += 1) {
          const item = list[i];
          if (isQuizTimelineItem(item)) {
            const q = normalizeQuizForApi([item]);
            if (!q.length) return `A pergunta na posição ${i + 1} está incompleta.`;
            continue;
          }
          if (!String(item?.image_url || '').trim()) {
            return `A página na posição ${i + 1} precisa de imagem.`;
          }
        }
      }
      return null;
    }

    return null;
  };

  const validateStep = (stepIndex, opts) => {
    if (stepIndex === 0 && !form.title.trim()) {
      return 'Indique o título do livro antes de continuar.';
    }
    if (stepIndex === 1) {
      return validateForSave(opts);
    }
    return validateForSave(opts);
  };

  const persist = async ({ publishing = false, workflowStatus, silent = false } = {}) => {
    setError(null);
    const validationError = validateForSave({ publishing });
    if (validationError) {
      setError(validationError);
      return { ok: false };
    }

    const wf = workflowStatus ?? (publishing ? 'published' : form.workflow_status || 'draft');
    setSaving(true);
    const payload = buildPayload(wf);
    const targetId = activeBookId;
    const result = targetId ? await updateBook(targetId, payload) : await createBook(payload);
    setSaving(false);

    if (result.error) {
      setError(result.error.message);
      return { ok: false };
    }

    if (!silent) {
      if (publishing) {
        patchForm({ workflow_status: 'published' });
        toast.success('Livro publicado na app.');
      } else {
        toast.success(targetId ? 'Alterações guardadas.' : 'Rascunho criado.');
      }
    } else if (publishing) {
      patchForm({ workflow_status: 'published' });
    }

    const newId = result.data?.id ? String(result.data.id) : null;
    if (newId && !targetId) {
      setActiveBookId(newId);
      setLastSavedAt(new Date());
    } else if (targetId) {
      setLastSavedAt(new Date());
    }

    if (result.data) {
      setForm(mapBookToForm(result.data, bookType, user?.id));
    }

    return { ok: true, data: result.data, bookId: newId || targetId };
  };

  const persistRef = useRef(null);
  persistRef.current = persist;

  useEffect(() => {
    if (!activeBookId || !form.title.trim()) return undefined;
    if (autosaveSkipRef.current) {
      autosaveSkipRef.current = false;
      return undefined;
    }
    const timer = setTimeout(() => {
      if (uploading || saving || !persistRef.current) return;
      persistRef.current({ publishing: false, silent: true }).then((res) => {
        if (res?.ok) setLastSavedAt(new Date());
      });
    }, 12000);
    return () => clearTimeout(timer);
  }, [form, activeBookId, uploading, saving]);

  const handleSaveDraft = async (e) => {
    e?.preventDefault?.();
    const err = validateForSave({ publishing: false });
    if (err) {
      setError(err);
      return;
    }
    const res = await persist({ publishing: false });
    if (res?.ok && res.bookId && !bookId) {
      router.replace(`/books/${res.bookId}/edit-flow?step=${step}`);
    }
  };

  const handleSubmit = handleSaveDraft;

  const handlePublishConfirm = async () => {
    const err = validateForSave({ publishing: true });
    if (err) {
      setError(err);
      setPublishModalOpen(false);
      return;
    }
    const res = await persist({ publishing: true, workflowStatus: 'published' });
    if (res.ok) setPublishModalOpen(false);
  };

  const goNextStep = async () => {
    const err = validateStep(step, { publishing: false });
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    const next = Math.min(step + 1, 2);

    if (form.title.trim()) {
      const res = await persist({ publishing: false, silent: true });
      if (!res.ok) return;
      const id = res.bookId || activeBookId;
      if (id && !activeBookId) {
        router.replace(`/books/${id}/edit-flow?step=${next}`);
        return;
      }
    }

    setStep(next);
    if (activeBookId) {
      router.replace(
        { pathname: `/books/${activeBookId}/edit-flow`, query: { step: String(next) } },
        undefined,
        { shallow: true },
      );
    }
  };

  const goPrevStep = () => {
    setError(null);
    const prev = Math.max(step - 1, 0);
    setStep(prev);
    if (activeBookId) {
      router.replace(
        { pathname: `/books/${activeBookId}/edit-flow`, query: { step: String(prev) } },
        undefined,
        { shallow: true },
      );
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
    uploadProgress,
    uploadMedia,
    error,
    setError,
    handleSubmit,
    handleSaveDraft,
    handlePublishConfirm,
    isEdit,
    onAuthorCreated,
    onCategoryCreated,
    loadingAuthors: loadingMeta,
    loadingCategories: loadingMeta,
    step,
    setStep,
    goNextStep,
    goPrevStep,
    validateStep,
    publishModalOpen,
    setPublishModalOpen,
    isPublished: isPublishedStatus(form.workflow_status),
    nextSceneId: () => nextSceneId(form.pages),
    activeBookId,
    lastSavedAt,
  };
}
