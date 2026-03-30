import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { createBook } from '../../lib/books';
import { getAuthors } from '../../lib/authors';
import { getCategories } from '../../lib/categories';
import { uploadFile } from '../../lib/storageApi';
import { useAuth } from '../../contexts/auth';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import { FaArrowLeft, FaImage } from 'react-icons/fa';
import { FiUpload } from 'react-icons/fi';
import EditorLayout from '../../components/EditorLayout';
import LoadingProgressOverlay from '../../components/LoadingProgressOverlay';
import Head from 'next/head';
import { importPptxForBook } from '../../lib/pptxImport';
import { CMS_ROLES, isRole } from '../../lib/roles';

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
    setLoading(true);
    setError(null);
    
    try {
      // Validação básica
      if (!title.trim()) {
        throw new Error('O título do livro é obrigatório');
      }
      
      const defaultPages = [{
        id: Date.now().toString(),
        background: '',
        elements: [],
        orientation: 'portrait'
      }];

      const bookData = {
        title: title.trim(),
        author_id: authorId || null,
        category_id: categoryId || null,
        description: description.trim(),
        cover_image: coverImage,
        created_at: new Date().toISOString(),
        pages: importedPages.length > 0 ? importedPages : defaultPages,
        ...(importSessionId ? { import_session_id: importSessionId } : {}),
      };
      
      console.log('Enviando dados do livro para criação:', bookData);
      
      const { data, error } = await createBook(bookData);
      
      if (error) {
        console.error('Erro retornado pela função createBook:', error);
        throw new Error(error.message || 'Erro ao criar o livro');
      }
      
      toast.success('Livro criado com sucesso!');
      if (importedPages.length > 0 && data?.id) {
        router.push(`/books/${data.id}/edit`);
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

      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center mb-6">
          <h1 className="text-2xl font-bold">Criar Novo Livro</h1>
        </div>
        
        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="title">
              Título*
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              required
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="author">
              Autor
            </label>
            <select
              id="author"
              value={authorId}
              onChange={(e) => setAuthorId(e.target.value)}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            >
              <option value="">Selecione um autor</option>
              {loadingAuthors ? (
                <option disabled>Carregando autores...</option>
              ) : (
                authors.map(author => (
                  <option key={author.id} value={author.id}>
                    {author.name}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="category">
              Categoria
            </label>
            <select
              id="category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            >
              <option value="">Selecione uma categoria</option>
              {loadingCategories ? (
                <option disabled>Carregando categorias...</option>
              ) : (
                categories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))
              )}
            </select>
          </div>
          
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="description">
              Descrição
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              rows="4"
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Importar PPTX
            </label>
            <div className="flex items-center gap-4">
              <label
                className={`font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline flex items-center cursor-pointer ${
                  importingPptx
                    ? 'bg-gray-400 text-white cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                }`}
              >
                <FiUpload className="mr-2" />
                {importingPptx ? 'Importando...' : 'Selecionar arquivo PPTX'}
                <input
                  type="file"
                  accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                  className="hidden"
                  onChange={handlePptxImport}
                  disabled={importingPptx}
                />
              </label>
              {importedPages.length > 0 && (
                <div className="text-sm text-green-600">
                  {importedPages.length} páginas importadas
                </div>
              )}
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Capa do Livro
            </label>
            <div className="flex items-center gap-4">
              <label className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline flex items-center cursor-pointer">
                <FaImage className="mr-2" />
                {uploadingCover ? 'Enviando...' : 'Enviar Imagem'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleCoverUpload}
                  disabled={uploadingCover}
                />
              </label>
              {coverImage && (
                <div className="text-sm text-green-600">Imagem selecionada</div>
              )}
            </div>
            
            {coverImage && (
              <div className="mt-4 border rounded p-4">
                <p className="text-sm text-gray-500 mb-2">Prévia:</p>
                <img src={coverImage} alt="Capa do livro" className="max-h-48 object-contain" />
              </div>
            )}
          </div>
          
          <div className="flex items-center justify-between">
            <button
              type="submit"
              disabled={loading}
              className={`bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline ${
                loading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {loading ? 'Criando...' : 'Criar Livro'}
            </button>
          </div>
        </form>
      </div>
    </EditorLayout>
  );
}

export async function getServerSideProps() {
  return {
    props: {}, // Será preenchido com dados client-side
  };
} 
