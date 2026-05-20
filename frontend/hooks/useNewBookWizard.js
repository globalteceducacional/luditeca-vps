import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { toast } from 'react-hot-toast';
import { createBook } from '../lib/books';
import { getAuthors } from '../lib/authors';
import { getCategories } from '../lib/categories';
import { uploadFile } from '../lib/storageApi';
import { useAuth } from '../contexts/auth';
import { importPptxForBook } from '../lib/pptxImport';
import { CMS_ROLES, isRole } from '../lib/roles';
import { migratePagesLegacyToV2, migratePagesV2ToLegacy } from '../lib/pagesV2/migrate';
import { buildInitialV2FromChapters, ensureBookOutlineOnV2 } from '../lib/bookFlowOutline';

function summarizeSlide(page) {
  const elements = Array.isArray(page?.elements) ? page.elements : [];
  const textCount = elements.filter((e) => e?.type === 'text').length;
  const imageCount = elements.filter((e) => e?.type === 'image').length;
  const hasBg = Boolean(page?.background && (typeof page.background === 'string' ? page.background : page.background?.url));
  const parts = [];
  if (textCount) parts.push(`${textCount} texto(s)`);
  if (imageCount) parts.push(`${imageCount} imagem(ns)`);
  if (hasBg) parts.push('fundo');
  return parts.length ? parts.join(', ') : 'sem mídia';
}

/**
 * Estado e ações do assistente «novo livro» (metadados, capítulos, PPTX opcional).
 * UI Argon: `/books/new`; legado EditorLayout: `/books/new-legacy`.
 */
export function useNewBookWizard() {
  const [title, setTitle] = useState('');
  const [authorId, setAuthorId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [authors, setAuthors] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loadingAuthors, setLoadingAuthors] = useState(true);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [importedPages, setImportedPages] = useState([]);
  const [importingPptx, setImportingPptx] = useState(false);
  const [pptxImportProgress, setPptxImportProgress] = useState(null);
  const [importSessionId, setImportSessionId] = useState(null);
  const [step, setStep] = useState(0);
  const [chapterTitles, setChapterTitles] = useState(['Conteúdo principal']);

  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
    if (!authLoading && user && !isRole(user, CMS_ROLES)) router.replace('/app');
  }, [authLoading, user, router]);

  useEffect(() => {
    async function loadAuthors() {
      try {
        setLoadingAuthors(true);
        const { data, error: err } = await getAuthors();
        if (err) throw err;
        setAuthors(data || []);
      } catch (err) {
        console.error('Erro ao carregar autores:', err);
        toast.error('Falha ao carregar a lista de autores');
      } finally {
        setLoadingAuthors(false);
      }
    }
    loadAuthors();
  }, []);

  useEffect(() => {
    async function loadCategories() {
      try {
        setLoadingCategories(true);
        const { data, error: err } = await getCategories();
        if (err) throw err;
        setCategories(data || []);
      } catch (err) {
        console.error('Erro ao carregar categorias:', err);
        toast.error('Falha ao carregar a lista de categorias');
      } finally {
        setLoadingCategories(false);
      }
    }
    loadCategories();
  }, []);

  const handleCoverUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingCover(true);
      const { url } = await uploadFile('covers', file.name, file);
      setCoverImage(url || '');
      toast.success('Capa enviada com sucesso!');
    } catch (err) {
      toast.error(err?.message || 'Falha ao enviar capa.');
    } finally {
      setUploadingCover(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (step < 3) {
      if (step === 1 && !title.trim()) {
        toast.error('Indique o título do livro para continuar.');
        return;
      }
      setStep((s) => Math.min(3, s + 1));
      return;
    }
    setLoading(true);
    setError(null);

    try {
      if (!title.trim()) {
        throw new Error('O título do livro é obrigatório');
      }

      let pages;
      let pages_v2;
      if (importedPages.length > 0) {
        pages = importedPages;
        pages_v2 = ensureBookOutlineOnV2(migratePagesLegacyToV2(importedPages));
      } else {
        const titles = chapterTitles.map((t) => String(t || '').trim()).filter(Boolean);
        pages_v2 = buildInitialV2FromChapters(titles.length ? titles : ['Conteúdo principal']);
        pages = migratePagesV2ToLegacy(pages_v2);
      }

      const bookData = {
        title: title.trim(),
        author_id: authorId || null,
        category_id: categoryId || null,
        description: description.trim(),
        cover_image: coverImage,
        created_at: new Date().toISOString(),
        pages,
        pages_v2,
        workflow_status: 'draft',
        ...(importSessionId ? { import_session_id: importSessionId } : {}),
      };

      const { data, error: createErr } = await createBook(bookData);

      if (createErr) {
        console.error('Erro retornado pela função createBook:', createErr);
        throw new Error(createErr.message || 'Erro ao criar o livro');
      }

      toast.success('Livro criado com sucesso!');
      if (data?.id) {
        router.push(`/books/${data.id}/edit-v2`);
      } else {
        router.push('/books');
      }
    } catch (err) {
      console.error('Exceção capturada no handleSubmit:', err);
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePptxImport = async (event) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile || !user?.id) return;

    try {
      setImportingPptx(true);
      setPptxImportProgress({
        phase: 'upload',
        percent: 0,
        message: 'Iniciando envio do arquivo...',
      });
      const payload = await importPptxForBook({
        bookId: 'new-book',
        userId: user.id,
        file: selectedFile,
        onProgress: (info) => {
          setPptxImportProgress({
            phase: info.phase,
            percent: typeof info.percent === 'number' ? info.percent : null,
            message: info.message || '',
          });
        },
      });

      if (!Array.isArray(payload?.pages) || payload.pages.length === 0) {
        throw new Error('A importação não retornou páginas válidas.');
      }
      setImportSessionId(payload?.importSessionId || null);

      const total = payload.pages.length;
      const built = [];
      for (let i = 0; i < total; i++) {
        const page = payload.pages[i];
        built.push(page);
        const pct = Math.round(((i + 1) / total) * 100);
        setPptxImportProgress({
          phase: 'slides',
          percent: pct,
          message: `Carregando slide ${i + 1}/${total} - ${summarizeSlide(page)}`,
        });
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 0));
      }
      setImportedPages(built);
      const warningCount = Array.isArray(payload?.warnings) ? payload.warnings.length : 0;
      if (warningCount > 0) {
        toast.success(
          `${payload?.message || 'Importação com avisos.'} Ajuste ${warningCount} página(s) no editor.`,
        );
      } else {
        toast.success(payload?.message || `PPTX importado com ${payload.pages.length} páginas.`);
      }
    } catch (err) {
      toast.error(err.message || 'Falha ao importar PPTX');
    } finally {
      setImportingPptx(false);
      if (event.target) {
        event.target.value = '';
      }
      setTimeout(() => setPptxImportProgress(null), 400);
    }
  };

  const goBackStep = () => setStep((s) => Math.max(s === 1 ? 0 : s - 1, 0));

  const sortByName = (list) =>
    [...list].sort((a, b) =>
      String(a.name || '').localeCompare(String(b.name || ''), 'pt', { sensitivity: 'base' }),
    );

  const onAuthorCreated = useCallback((author) => {
    setAuthors((prev) => {
      const without = prev.filter((a) => String(a.id) !== String(author.id));
      return sortByName([...without, author]);
    });
    setAuthorId(String(author.id));
  }, []);

  const onCategoryCreated = useCallback((category) => {
    setCategories((prev) => {
      const without = prev.filter((c) => String(c.id) !== String(category.id));
      return sortByName([...without, category]);
    });
    setCategoryId(String(category.id));
  }, []);

  const patchWizardForm = useCallback(
    (patch) => {
      if (patch.title !== undefined) setTitle(patch.title);
      if (patch.description !== undefined) setDescription(patch.description);
      if (patch.author_id !== undefined) setAuthorId(patch.author_id);
      if (patch.category_id !== undefined) setCategoryId(patch.category_id);
      if (patch.cover_image !== undefined) setCoverImage(patch.cover_image);
    },
    [],
  );

  return {
    authLoading,
    user,
    title,
    setTitle,
    authorId,
    setAuthorId,
    categoryId,
    setCategoryId,
    description,
    setDescription,
    coverImage,
    setCoverImage,
    loading,
    error,
    uploadingCover,
    authors,
    categories,
    loadingAuthors,
    loadingCategories,
    importedPages,
    importingPptx,
    pptxImportProgress,
    step,
    setStep,
    chapterTitles,
    setChapterTitles,
    handleCoverUpload,
    handleSubmit,
    handlePptxImport,
    goBackStep,
    onAuthorCreated,
    onCategoryCreated,
    patchWizardForm,
  };
}
