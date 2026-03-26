import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { FiPlus, FiEdit, FiTrash2 } from 'react-icons/fi';

import { useAuth } from '../../contexts/auth';
import { getAuthors, deleteAuthor } from '../../lib/authors';
import { getFileUrl } from '../../lib/mediaUrl';
import Layout from '../../components/Layout';
import { ADMIN_ONLY, isRole } from '../../lib/roles';
import { devLog } from '../../lib/devLog';

export default function Authors() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  
  const [authors, setAuthors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Verificar autenticação
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
    if (!authLoading && user && !isRole(user, ADMIN_ONLY)) {
      router.replace('/books');
    }
  }, [authLoading, user, router]);
  
  // Carregar autores do Supabase
  useEffect(() => {
    if (user) {
      fetchAuthors();
    }
  }, [user]);
  
  // Função para buscar autores
  const fetchAuthors = async () => {
    try {
      setLoading(true);
      const { data, error } = await getAuthors();
      
      if (error) {
        throw error;
      }
      
      devLog('Autores carregados:', data);
      
      // Processar os dados para obter URLs de imagens
      const authorsWithImages = data.map(author => {
        let imageUrl = null;
        
        // Verificar se existe photo_url
        if (author.photo_url) {
          // Se for uma URL completa, usar diretamente
          if (author.photo_url.startsWith('http')) {
            imageUrl = author.photo_url;
          } else {
            // Caso contrário, obter do bucket 'autores'
            imageUrl = getFileUrl('autores', author.photo_url);
          }
        }
        
        return {
          ...author,
          imageUrl
        };
      });
      
      setAuthors(authorsWithImages || []);
    } catch (err) {
      console.error('Erro ao carregar autores:', err);
      setError('Falha ao carregar os autores. Por favor, tente novamente.');
    } finally {
      setLoading(false);
    }
  };
  
  // Função para excluir um autor
  const handleDeleteAuthor = async (id) => {
    if (window.confirm('Tem certeza que deseja excluir este autor? Esta ação não pode ser desfeita.')) {
      try {
        setDeleteLoading(id);
        const { error } = await deleteAuthor(id);
        
        if (error) {
          throw error;
        }
        
        // Atualizar a lista de autores
        setAuthors(authors.filter(author => author.id !== id));
      } catch (err) {
        console.error('Erro ao excluir autor:', err);
        alert('Falha ao excluir o autor. Por favor, tente novamente.');
      } finally {
        setDeleteLoading(null);
      }
    }
  };
  
  // Função para criar um novo autor
  const handleCreateAuthor = () => {
    router.push('/authors/new');
  };
  
  // Filtrar autores com base no termo de pesquisa
  const filteredAuthors = authors.filter(author => 
    author.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    author.bio?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Carregando autores...</div>
        </div>
      </Layout>
    );
  }
  
  return (
    <>
      <Head>
        <title>Gerenciar Autores | UniverseTeca CMS</title>
      </Head>
      
      <Layout>
        <div className="container mx-auto px-4 py-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">Gerenciar Autores</h1>
            
            <button
              onClick={handleCreateAuthor}
              className="flex items-center px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              <FiPlus className="mr-2" />
              Novo Autor
            </button>
          </div>
          
          {/* Barra de pesquisa */}
          <div className="mb-6">
            <div className="relative max-w-md mx-auto">
              <input
                type="text"
                placeholder="Pesquisar autores por nome ou biografia..."
                className="w-full px-4 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </div>
          
          {error && (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6">
              {error}
            </div>
          )}
          
          {authors.length === 0 ? (
            <div className="bg-gray-100 p-8 rounded-lg text-center">
              <p className="text-lg text-gray-600 mb-4">
                Nenhum autor encontrado
              </p>
              <button
                onClick={handleCreateAuthor}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Cadastrar primeiro autor
              </button>
            </div>
          ) : filteredAuthors.length === 0 ? (
            <div className="bg-gray-100 p-8 rounded-lg text-center">
              <p className="text-lg text-gray-600 mb-4">
                Nenhum autor encontrado com o termo "{searchTerm}"
              </p>
              <button
                onClick={() => setSearchTerm('')}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Limpar pesquisa
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Foto
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nome
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Biografia
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredAuthors.map((author) => (
                    <tr key={author.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {author.imageUrl ? (
                            <div 
                              className="h-12 w-12 rounded-full bg-cover bg-center bg-no-repeat"
                              style={{ backgroundImage: `url(${author.imageUrl})` }}
                            ></div>
                          ) : (
                            <div className="h-12 w-12 rounded-full bg-gray-200 flex items-center justify-center">
                              <span className="text-gray-500 text-xs">Sem foto</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{author.name || 'Sem nome'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-500 line-clamp-2">{author.bio || 'Sem biografia'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => router.push(`/authors/${author.id}/edit`)}
                            className="flex items-center px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                          >
                            <FiEdit className="mr-1" />
                            Editar
                          </button>
                          
                          <button
                            onClick={() => handleDeleteAuthor(author.id)}
                            className="flex items-center px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                            disabled={deleteLoading === author.id}
                          >
                            <FiTrash2 className="mr-1" />
                            {deleteLoading === author.id ? 'Excluindo...' : 'Excluir'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Layout>
    </>
  );
} 