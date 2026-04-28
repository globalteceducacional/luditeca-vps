import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { createBook } from '../../lib/books';
import { getAuthors } from '../../lib/authors';
import { getCategories } from '../../lib/categories';
import { uploadFile } from '../../lib/storageApi';
import { useAuth } from '../../contexts/auth';
import { toast } from 'react-hot-toast';
import { FaArrowLeft, FaImage } from 'react-icons/fa';
import { FiUpload } from 'react-icons/fi';
import EditorLayout from '../../components/EditorLayout';
import LoadingProgressOverlay from '../../components/LoadingProgressOverlay';
import Head from 'next/head';
import { importPptxForBook } from '../../lib/pptxImport';
import { CMS_ROLES, isRole } from '../../lib/roles';
import { migratePagesLegacyToV2, migratePagesV2ToLegacy } from '../../lib/pagesV2/migrate';
import { buildInitialV2FromChapters, ensureBookOutlineOnV2 } from '../../lib/bookFlowOutline';

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

export default function NewBook() {
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
  /** Assistente 3.2: 0 intro, 1 metadados, 2 capítulos, 3 conteúdo inicial */
  const [step, setStep] = useState(0);
  const [chapterTitles, setChapterTitles] = useState(['Conteúdo principal']);

  const { user, loading: isLoading } = useAuth();
  const router = useRouter();
  
  // Verificar autenticação
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
    if (!isLoading && user && !isRole(user, CMS_ROLES)) {
      router.replace('/app');
    }
  }, [isLoading, user, router]);

  // Carregar autores
  useEffect(() => {
    async function loadAuthors() {
      try {
        setLoadingAuthors(true);
        const { data, error } = await getAuthors();
        if (error) throw error;
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

  // Carregar categorias
  useEffect(() => {
    async function loadCategories() {
      try {
        setLoadingCategories(true);
        const { data, error } = await getCategories();
        if (error) throw error;
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

      const { data, error } = await createBook(bookData);
      
      if (error) {
        console.error('Erro retornado pela função createBook:', error);
        throw new Error(error.message || 'Erro ao criar o livro');
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
            percent:
              typeof info.percent === 'number' ? info.percent : null,
            message: info.message || '',
          });
        },
      });

      if (!Array.isArray(payload?.pages) || payload.pages.length === 0) {
        throw new Error('A importação não retornou páginas válidas.');
      }
      setImportSessionId(payload?.importSessionId || null);

      // Atualiza o progresso com feedback por slide (UI mais clara)
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
        // Yield para renderizar a mensagem antes de continuar
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
  
  if (isLoading) {
    return (
      <EditorLayout>
        <Head>
          <title>Novo Livro - Luditeca</title>
        </Head>
        <LoadingProgressOverlay
          active
          title="Carregando"
          message="Verificando sua sessão..."
          mode="indeterminate"
        />
      </EditorLayout>
    );
  }
  
  return (
    <EditorLayout>
      <Head>
        <title>Novo Livro - Luditeca</title>
      </Head>

      {importingPptx ? (
        <LoadingProgressOverlay
          active
          title="Importando..."
          message={pptxImportProgress?.message || 'Processando...'}
          compact
          showFooterHint={false}
          mode={
            typeof pptxImportProgress?.percent === 'number'
              ? 'determinate'
              : 'indeterminate'
          }
          percent={
            typeof pptxImportProgress?.percent === 'number'
              ? pptxImportProgress.percent
              : 0
          }
        />
      ) : null}

      {loading ? (
        <LoadingProgressOverlay
          active
          title="Criando livro"
          message="Salvando no servidor..."
          mode="indeterminate"
        />
      ) : null}

      <div className="container mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-800">Criar novo livro</h1>
          <p className="mt-1 text-sm text-gray-600">Assistente em passos — sem conhecimento técnico profundo.</p>
        </div>

        <div className="mb-6 flex flex-wrap justify-center gap-2">
          {['Início', 'Metadados', 'Capítulos', 'Conteúdo'].map((label, i) => (
            <div
              key={label}
              className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                step === i ? 'bg-blue-600 text-white' : step > i ? 'bg-blue-100 text-blue-800' : 'bg-gray-200 text-gray-600'
              }`}
            >
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-[11px]">
                {i + 1}
              </span>
              {label}
            </div>
          ))}
        </div>

        {error && (
          <div className="mb-4 border-l-4 border-red-500 bg-red-100 p-4 text-red-700">{error}</div>
        )}

        {step === 0 ? (
          <div className="rounded-lg bg-white p-8 shadow-md">
            <h2 className="text-lg font-semibold text-gray-800">Bem-vindo</h2>
            <p className="mt-3 text-gray-600">
              Vai definir o título e a ficha do livro, organizar <strong>capítulos</strong> (secções simples) e, se
              quiser, importar um ficheiro PowerPoint. No fim, abrimos o <strong>editor visual</strong> para
              continuar a trabalhar as páginas.
            </p>
            <button
              type="button"
              className="mt-6 rounded bg-blue-600 px-6 py-2 font-semibold text-white hover:bg-blue-700"
              onClick={() => setStep(1)}
            >
              Começar
            </button>
          </div>
        ) : null}

        {step >= 1 ? (
          <form onSubmit={handleSubmit} className="rounded-lg bg-white px-8 py-6 shadow-md">
            {step === 1 ? (
              <>
                <h2 className="mb-4 text-lg font-semibold text-gray-800">Metadados</h2>
                <div className="mb-4">
                  <label className="mb-2 block text-sm font-bold text-gray-700" htmlFor="title">
                    Título *
                  </label>
                  <input
                    id="title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full rounded border px-3 py-2 text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    required
                  />
                </div>
                <div className="mb-4">
                  <label className="mb-2 block text-sm font-bold text-gray-700" htmlFor="author">
                    Autor
                  </label>
                  <select
                    id="author"
                    value={authorId}
                    onChange={(e) => setAuthorId(e.target.value)}
                    className="w-full rounded border px-3 py-2 text-gray-700 shadow-sm"
                  >
                    <option value="">Selecione um autor</option>
                    {loadingAuthors ? (
                      <option disabled>Carregando autores...</option>
                    ) : (
                      authors.map((author) => (
                        <option key={author.id} value={author.id}>
                          {author.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <div className="mb-4">
                  <label className="mb-2 block text-sm font-bold text-gray-700" htmlFor="category">
                    Categoria
                  </label>
                  <select
                    id="category"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full rounded border px-3 py-2 text-gray-700 shadow-sm"
                  >
                    <option value="">Selecione uma categoria</option>
                    {loadingCategories ? (
                      <option disabled>Carregando categorias...</option>
                    ) : (
                      categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <div className="mb-4">
                  <label className="mb-2 block text-sm font-bold text-gray-700" htmlFor="description">
                    Descrição
                  </label>
                  <textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full rounded border px-3 py-2 text-gray-700 shadow-sm"
                    rows={4}
                  />
                </div>
                <div className="mb-4">
                  <label className="mb-2 block text-sm font-bold text-gray-700">Capa</label>
                  <div className="flex flex-wrap items-center gap-4">
                    <label className="flex cursor-pointer items-center rounded bg-blue-500 px-4 py-2 font-bold text-white hover:bg-blue-600">
                      <FaImage className="mr-2" />
                      {uploadingCover ? 'A enviar…' : 'Enviar imagem'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleCoverUpload}
                        disabled={uploadingCover}
                      />
                    </label>
                    {coverImage ? <span className="text-sm text-green-600">Capa selecionada</span> : null}
                  </div>
                  {coverImage ? (
                    <div className="mt-4 rounded border p-4">
                      <img src={coverImage} alt="" className="max-h-48 object-contain" />
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}

            {step === 2 ? (
              <>
                <h2 className="mb-2 text-lg font-semibold text-gray-800">Capítulos</h2>
                <p className="mb-4 text-sm text-gray-600">
                  Cada capítulo gera uma primeira página vazia no livro — pode renomear e acrescentar mais páginas
                  depois no editor. Se importar PPTX no passo seguinte, as páginas do ficheiro passam à frente desta
                  estrutura.
                </p>
                <div className="space-y-2">
                  {chapterTitles.map((ch, i) => (
                    <div key={`ch-row-${i}`} className="flex gap-2">
                      <input
                        type="text"
                        value={ch}
                        onChange={(e) => {
                          const next = [...chapterTitles];
                          next[i] = e.target.value;
                          setChapterTitles(next);
                        }}
                        className="flex-1 rounded border px-3 py-2 text-gray-800"
                        placeholder={`Capítulo ${i + 1}`}
                      />
                      {chapterTitles.length > 1 ? (
                        <button
                          type="button"
                          className="rounded border border-red-200 px-2 text-sm text-red-600 hover:bg-red-50"
                          onClick={() => setChapterTitles(chapterTitles.filter((_, j) => j !== i))}
                        >
                          Remover
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="mt-3 rounded border border-blue-300 px-3 py-1 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                  onClick={() => setChapterTitles([...chapterTitles, `Capítulo ${chapterTitles.length + 1}`])}
                >
                  + Adicionar capítulo
                </button>
              </>
            ) : null}

            {step === 3 ? (
              <>
                <h2 className="mb-2 text-lg font-semibold text-gray-800">Conteúdo inicial</h2>
                <p className="mb-4 text-sm text-gray-600">
                  Opcional: importe um PowerPoint para criar várias páginas de uma vez. Se não importar, usamos os
                  capítulos do passo anterior (uma página por capítulo).
                </p>
                <div className="mb-4 flex flex-wrap items-center gap-4">
                  <label
                    className={`flex cursor-pointer items-center rounded px-4 py-2 font-bold text-white ${
                      importingPptx ? 'cursor-not-allowed bg-gray-400' : 'bg-indigo-600 hover:bg-indigo-700'
                    }`}
                  >
                    <FiUpload className="mr-2" />
                    {importingPptx ? 'A importar…' : 'Selecionar PPTX'}
                    <input
                      type="file"
                      accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                      className="hidden"
                      onChange={handlePptxImport}
                      disabled={importingPptx}
                    />
                  </label>
                  {importedPages.length > 0 ? (
                    <span className="text-sm font-medium text-green-700">{importedPages.length} páginas importadas</span>
                  ) : null}
                </div>
              </>
            ) : null}

            <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <button
                type="button"
                className="rounded border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                onClick={() => setStep((s) => Math.max(s === 1 ? 0 : s - 1, 0))}
              >
                {step === 1 ? '← Início' : '← Anterior'}
              </button>
              {step < 3 ? (
                <button
                  type="submit"
                  className="rounded bg-blue-600 px-6 py-2 font-semibold text-white hover:bg-blue-700"
                >
                  Seguinte
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading}
                  className={`rounded bg-emerald-600 px-6 py-2 font-semibold text-white hover:bg-emerald-500 ${
                    loading ? 'cursor-not-allowed opacity-50' : ''
                  }`}
                >
                  {loading ? 'A criar…' : 'Criar livro e abrir editor'}
                </button>
              )}
            </div>
          </form>
        ) : null}
      </div>
    </EditorLayout>
  );
}

export async function getServerSideProps() {
  return {
    props: {}, // Será preenchido com dados client-side
  };
} 
