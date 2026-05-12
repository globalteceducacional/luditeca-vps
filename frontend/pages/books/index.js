import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { FiPlus, FiEdit, FiTrash2, FiBook } from 'react-icons/fi';

import { useAuth } from '../../contexts/auth';
import { getBooks, deleteBook, updateBook, searchBooks } from '../../lib/books';
import { getFileUrl } from '../../lib/mediaUrl';
import Layout from '../../components/Layout';
import { CMS_ROLES, isRole } from '../../lib/roles';
import { devLog } from '../../lib/devLog';

const WORKFLOW_OPTIONS = [
  { value: 'draft', label: 'Rascunho' },
  { value: 'review', label: 'Revisão' },
  { value: 'published', label: 'Publicado' },
  { value: 'archived', label: 'Arquivo' },
];

const PAGE_SIZE = 50;

export default function Books() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(null);
  const [workflowSaving, setWorkflowSaving] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [advCharacter, setAdvCharacter] = useState('');
  const [advCollection, setAdvCollection] = useState('');
  const [advKeyword, setAdvKeyword] = useState('');
  const [advLevel, setAdvLevel] = useState('');
  const [showSearchFilters, setShowSearchFilters] = useState(false);
  // Paginação 1-based; `total` é o total no servidor (quando paginado).
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const latestRequestRef = useRef(0);
  const isListRefreshing = loading || deleteLoading !== null || workflowSaving !== null;

  const hasActiveSearch =
    Boolean(searchTerm.trim()) ||
    Boolean(advCharacter.trim()) ||
    Boolean(advCollection.trim()) ||
    Boolean(advKeyword.trim()) ||
    Boolean(advLevel.trim());

  const clearSearchFilters = useCallback(() => {
    setSearchTerm('');
    setAdvCharacter('');
    setAdvCollection('');
    setAdvKeyword('');
    setAdvLevel('');
  }, []);

  // Verificar autenticação
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
    if (!authLoading && user && !isRole(user, CMS_ROLES)) {
      router.replace('/app');
    }
  }, [authLoading, user, router]);
  
  const mapBooksWithCoverUrls = (data) =>
    (data || []).map((book) => {
      let coverUrl = null;
      if (book.cover_image) {
        if (book.cover_image.startsWith('http')) {
          coverUrl = book.cover_image;
        } else {
          coverUrl = getFileUrl('covers', book.cover_image);
        }
      }
      return { ...book, coverUrl };
    });

  const loadBooksList = useCallback(async () => {
    if (!user) return;
    const requestId = Date.now() + Math.random();
    latestRequestRef.current = requestId;
    const serverSearch = hasActiveSearch;
    try {
      setLoading(true);
      setError(null);
      let data = [];
      let nextTotal = 0;
      if (!serverSearch) {
        const offset = Math.max(0, (page - 1) * PAGE_SIZE);
        const { data: rows, total: srvTotal, error } = await getBooks({
          limit: PAGE_SIZE,
          offset,
        });
        if (error) throw error;
        data = rows || [];
        nextTotal = typeof srvTotal === 'number' ? srvTotal : data.length;
        devLog('Livros carregados:', { count: data.length, total: nextTotal, page });
      } else {
        const { data: rows, total: srvTotal, error } = await searchBooks({
          q: searchTerm.trim(),
          character: advCharacter.trim() || undefined,
          collection: advCollection.trim() || undefined,
          keyword: advKeyword.trim() || undefined,
          level: advLevel.trim() || undefined,
          limit: 100,
        });
        if (error) throw error;
        data = rows || [];
        nextTotal = typeof srvTotal === 'number' ? srvTotal : data.length;
        devLog('Busca catálogo:', { total: nextTotal });
      }
      if (latestRequestRef.current !== requestId) return;
      setBooks(mapBooksWithCoverUrls(data));
      setTotal(nextTotal);
    } catch (err) {
      if (latestRequestRef.current !== requestId) return;
      console.error('Erro ao carregar livros:', err);
      setError('Falha ao carregar os livros. Por favor, tente novamente.');
    } finally {
      if (latestRequestRef.current !== requestId) return;
      setLoading(false);
    }
  }, [user, hasActiveSearch, searchTerm, advCharacter, advCollection, advKeyword, advLevel, page]);

  useEffect(() => {
    if (!user) return undefined;
    const t = window.setTimeout(() => {
      void loadBooksList();
    }, 400);
    return () => window.clearTimeout(t);
  }, [user, loadBooksList]);

  // Reset da paginação quando filtros de busca mudam (debounce já é aplicado em loadBooksList).
  useEffect(() => {
    setPage(1);
  }, [searchTerm, advCharacter, advCollection, advKeyword, advLevel]);
  
  // Função para excluir um livro
  const handleDeleteBook = async (id) => {
    if (window.confirm('Tem certeza que deseja excluir este livro? Esta ação não pode ser desfeita.')) {
      try {
        setDeleteLoading(id);
        const { error } = await deleteBook(id);
        
        if (error) {
          throw error;
        }
        
        await loadBooksList();
      } catch (err) {
        console.error('Erro ao excluir livro:', err);
        const msg =
          typeof err?.message === 'string' && err.message.trim() !== ''
            ? err.message
            : 'Falha ao excluir o livro. Por favor, tente novamente.';
        alert(msg);
      } finally {
        setDeleteLoading(null);
      }
    }
  };
  
  // Função para criar um novo livro
  const handleCreateBook = () => {
    router.push('/books/new');
  };

  const handleWorkflowChange = async (bookId, next) => {
    setWorkflowSaving(bookId);
    try {
      const { error } = await updateBook(bookId, { workflow_status: next });
      if (error) throw error;
      await loadBooksList();
    } catch (err) {
      console.error(err);
      const msg =
        typeof err?.message === 'string' && err.message.trim() !== ''
          ? err.message
          : 'Não foi possível atualizar o estado editorial.';
      alert(msg);
    } finally {
      setWorkflowSaving(null);
    }
  };
  
  // Full-loading só na primeira leitura; mudanças de página/busca mostram os
  // cartões anteriores e desabilitam os controles enquanto recarregam.
  if (loading && books.length === 0) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Carregando livros...</div>
        </div>
      </Layout>
    );
  }
  
  return (
    <>
      <Head>
        <title>Gerenciar Livros | Luditeca CMS</title>
      </Head>
      
      <Layout>
        <div className="container mx-auto px-4 py-6">
          <div className="flex justify-between items-start gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold">Gerenciar Livros</h1>
              <p className="text-sm text-gray-500 mt-1 max-w-xl">
                Novo livro abre um assistente: metadados, capítulos e importação opcional de PPTX; depois edite no editor v2.
              </p>
            </div>
            <button
              onClick={handleCreateBook}
              disabled={isListRefreshing}
              className="flex items-center px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FiPlus className="mr-2" />
              Novo Livro
            </button>
          </div>
          
          {/* Busca no catálogo (índice no servidor) */}
          <div className="mb-6 max-w-3xl mx-auto space-y-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Busca por título, texto na ficha, autor, categoria, palavras-chave…"
                className="w-full px-4 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-50"
                value={searchTerm}
                disabled={isListRefreshing}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
            <button
              type="button"
              className="text-sm text-blue-600 hover:underline disabled:cursor-not-allowed disabled:text-gray-400 disabled:no-underline"
              disabled={isListRefreshing}
              onClick={() => setShowSearchFilters((v) => !v)}
            >
              {showSearchFilters ? 'Ocultar filtros' : 'Filtros (personagem, coleção, palavra-chave, nível)'}
            </button>
            {showSearchFilters ? (
              <div className="grid gap-3 sm:grid-cols-2 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <label className="block text-sm">
                  <span className="text-gray-600">Personagem</span>
                  <input
                    className="mt-1 w-full rounded border px-2 py-1.5 disabled:cursor-not-allowed disabled:bg-gray-100"
                    value={advCharacter}
                    disabled={isListRefreshing}
                    onChange={(e) => setAdvCharacter(e.target.value)}
                    placeholder="Nome do personagem"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-gray-600">Coleção</span>
                  <input
                    className="mt-1 w-full rounded border px-2 py-1.5 disabled:cursor-not-allowed disabled:bg-gray-100"
                    value={advCollection}
                    disabled={isListRefreshing}
                    onChange={(e) => setAdvCollection(e.target.value)}
                    placeholder="Nome da coleção"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-gray-600">Palavra-chave</span>
                  <input
                    className="mt-1 w-full rounded border px-2 py-1.5 disabled:cursor-not-allowed disabled:bg-gray-100"
                    value={advKeyword}
                    disabled={isListRefreshing}
                    onChange={(e) => setAdvKeyword(e.target.value)}
                    placeholder="Termo do índice"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-gray-600">Nível</span>
                  <input
                    className="mt-1 w-full rounded border px-2 py-1.5 disabled:cursor-not-allowed disabled:bg-gray-100"
                    value={advLevel}
                    disabled={isListRefreshing}
                    onChange={(e) => setAdvLevel(e.target.value)}
                    placeholder="Ex.: 6º ano, iniciante…"
                  />
                </label>
              </div>
            ) : null}
          </div>
          
          {error && (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span>{error}</span>
                <button
                  type="button"
                  disabled={isListRefreshing}
                  onClick={() => void loadBooksList()}
                  className="self-start rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Tentar novamente
                </button>
              </div>
            </div>
          )}
          
          {books.length === 0 && !hasActiveSearch ? (
            <div className="bg-gray-100 p-8 rounded-lg text-center">
              <p className="text-lg text-gray-600 mb-4">
                Nenhum livro encontrado
              </p>
              <button
                onClick={handleCreateBook}
                disabled={isListRefreshing}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Criar meu primeiro livro
              </button>
            </div>
          ) : books.length === 0 && hasActiveSearch ? (
            <div className="bg-gray-100 p-8 rounded-lg text-center">
              <p className="text-lg text-gray-600 mb-4">
                Nenhum resultado para os filtros de busca atuais.
              </p>
              <button
                type="button"
                onClick={() => {
                  clearSearchFilters();
                }}
                disabled={isListRefreshing}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Limpar pesquisa
              </button>
            </div>
          ) : (
            <>
            {loading ? (
              <div className="mb-3 rounded border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-700">
                Atualizando resultados...
              </div>
            ) : null}
            <div
              className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
              aria-busy={loading}
            >
              {books.map(book => (
                <div key={book.id} className="bg-white rounded-lg shadow-sm overflow-hidden">
                  <div 
                    className="h-36 bg-gray-200 flex items-center justify-center"
                    style={{
                      backgroundImage: book.coverUrl ? `url(${book.coverUrl})` : 'none',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center'
                    }}
                  >
                    {!book.coverUrl && (
                      <div className="flex flex-col items-center justify-center text-gray-500">
                        <FiBook size={24} />
                        <span className="mt-1 text-sm">Sem capa</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="p-3">
                    <h2 className="text-base font-semibold mb-1 truncate">
                      {book.title || 'Sem título'}
                    </h2>
                    
                    <p className="text-gray-600 text-xs mb-1">
                      <span className="font-medium">Autor:</span> {book.authors?.name || 'Desconhecido'}
                    </p>
                    
                    <p className="text-gray-600 text-xs mb-2 line-clamp-2 h-8">
                      {book.description || 'Sem descrição'}
                    </p>

                    <label className="block text-[10px] uppercase text-gray-500 mb-0.5">Estado editorial</label>
                    <select
                      value={book.workflow_status || 'draft'}
                      disabled={isListRefreshing}
                      onChange={(e) => handleWorkflowChange(book.id, e.target.value)}
                      className={`text-xs border rounded w-full px-1 py-1 bg-white disabled:cursor-not-allowed disabled:bg-gray-100 ${
                        workflowSaving === book.id ? 'mb-1' : 'mb-2'
                      }`}
                    >
                      {WORKFLOW_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    {workflowSaving === book.id ? (
                      <p className="mb-2 text-[10px] text-blue-600">Salvando estado editorial…</p>
                    ) : null}
                    
                    <div className="flex justify-between">
                      <button
                        onClick={() => router.push(`/books/${book.id}/edit`)}
                        disabled={isListRefreshing}
                        className="flex items-center px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <FiEdit className="mr-1" size={12} />
                        Editar
                      </button>
                      
                      <button
                        onClick={() => handleDeleteBook(book.id)}
                        className="flex items-center px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={isListRefreshing || deleteLoading === book.id}
                      >
                        <FiTrash2 className="mr-1" size={12} />
                        {deleteLoading === book.id ? 'Excluindo...' : 'Excluir'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {/* Paginação só faz sentido quando não há busca ativa (search devolve top 100 sem paginação cliente). */}
            {!hasActiveSearch && total > PAGE_SIZE ? (
              <div className="mt-6 flex items-center justify-between gap-3 text-sm text-gray-700">
                <span>
                  Mostrando{' '}
                  <strong>
                    {Math.min(total, (page - 1) * PAGE_SIZE + 1)}-
                    {Math.min(total, (page - 1) * PAGE_SIZE + books.length)}
                  </strong>{' '}
                  de <strong>{total}</strong>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1 || isListRefreshing}
                    className="rounded border px-3 py-1 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-gray-50"
                  >
                    Anterior
                  </button>
                  <span className="px-2 text-gray-500">
                    Página {page} de {Math.max(1, Math.ceil(total / PAGE_SIZE))}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setPage((p) => (p * PAGE_SIZE < total ? p + 1 : p))
                    }
                    disabled={page * PAGE_SIZE >= total || isListRefreshing}
                    className="rounded border px-3 py-1 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-gray-50"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            ) : null}
            </>
          )}
        </div>
      </Layout>
    </>
  );
} 
