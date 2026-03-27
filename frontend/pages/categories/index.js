import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { FiPlus, FiEdit, FiTrash2 } from 'react-icons/fi';

import { useAuth } from '../../contexts/auth';
import { getCategories, deleteCategory } from '../../lib/categories';
import { getFileUrl } from '../../lib/mediaUrl';
import { devLog } from '../../lib/devLog';
import Layout from '../../components/Layout';
import { ADMIN_ONLY, isRole } from '../../lib/roles';

export default function Categories() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Verificar autenticaÃ§Ã£o
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
    if (!authLoading && user && !isRole(user, ADMIN_ONLY)) {
      router.replace('/books');
    }
  }, [authLoading, user, router]);
  
  // Carregar categorias do Supabase
  useEffect(() => {
    if (user) {
      fetchCategories();
    }
  }, [user]);
  
  // Improved fetchCategories function with better debugging
  const fetchCategories = async () => {
    try {
      setLoading(true);
      const { data, error } = await getCategories();
      
      if (error) {
        throw error;
      }
      
      devLog('Categorias carregadas (raw data):', data);
      
      // Processar os dados para obter URLs de imagens
      const categoriesWithImages = data.map(category => {
        let imageUrl = null;
        
        // Verificar se existe image_url e nÃ£o estÃ¡ vazio
        if (category.image_url && category.image_url.trim() !== '') {
          // Se for uma URL completa, usar diretamente
          if (category.image_url.startsWith('http')) {
            imageUrl = category.image_url;
          } else {
            // Caso contrÃ¡rio, obter do bucket 'categories'
            imageUrl = getFileUrl('categories', category.image_url);
          }
        }
        
        devLog(`Categoria "${category.name}" (id: ${category.id}):`, { 
          raw_image_url: category.image_url,
          processed_imageUrl: imageUrl 
        });
        
        return {
          ...category,
          imageUrl
        };
      });
      
      setCategories(categoriesWithImages || []);
    } catch (err) {
      console.error('Erro ao carregar categorias:', err);
      setError('Falha ao carregar as categorias. Por favor, tente novamente.');
    } finally {
      setLoading(false);
    }
  };
  
  // FunÃ§Ã£o para excluir uma categoria
  const handleDeleteCategory = async (id) => {
    if (window.confirm('Tem certeza que deseja excluir esta categoria? Esta aÃ§Ã£o nÃ£o pode ser desfeita.')) {
      try {
        setDeleteLoading(id);
        const { error } = await deleteCategory(id);
        
        if (error) {
          throw error;
        }
        
        // Atualizar a lista de categorias
        setCategories(categories.filter(category => category.id !== id));
      } catch (err) {
        console.error('Erro ao excluir categoria:', err);
        alert('Falha ao excluir a categoria. Por favor, tente novamente.');
      } finally {
        setDeleteLoading(null);
      }
    }
  };
  
  // FunÃ§Ã£o para criar uma nova categoria
  const handleCreateCategory = () => {
    router.push('/categories/new');
  };
  
  // Filtrar categorias com base no termo de pesquisa
  const filteredCategories = categories.filter(category => 
    category.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Carregando categorias...</div>
        </div>
      </Layout>
    );
  }
  
  return (
    <>
      <Head>
        <title>Gerenciar Categorias | Luditeca CMS</title>
      </Head>
      
      <Layout>
        <div className="container mx-auto px-4 py-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">Gerenciar Categorias</h1>
            
            <button
              onClick={handleCreateCategory}
              className="flex items-center px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              <FiPlus className="mr-2" />
              Nova Categoria
            </button>
          </div>
          
          {/* Barra de pesquisa */}
          <div className="mb-6">
            <div className="relative max-w-md mx-auto">
              <input
                type="text"
                placeholder="Pesquisar categorias por nome..."
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
          
          {categories.length === 0 ? (
            <div className="bg-gray-100 p-8 rounded-lg text-center">
              <p className="text-lg text-gray-600 mb-4">
                Nenhuma categoria encontrada
              </p>
              <button
                onClick={handleCreateCategory}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Criar primeira categoria
              </button>
            </div>
          ) : filteredCategories.length === 0 ? (
            <div className="bg-gray-100 p-8 rounded-lg text-center">
              <p className="text-lg text-gray-600 mb-4">
                Nenhuma categoria encontrada com o termo "{searchTerm}"
              </p>
              <button
                onClick={() => setSearchTerm('')}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Limpar pesquisa
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredCategories.map(category => (
                <div key={category.id} className="bg-white rounded-lg shadow-sm overflow-hidden">
                  <div 
                    className="h-28 flex items-center justify-center"
                    style={{ 
                      backgroundColor: category.color || '#f3f4f6',
                      backgroundImage: category.imageUrl ? `url(${category.imageUrl})` : 'none',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center'
                    }}
                  >
                    {!category.imageUrl && (
                      <h2 className="text-xl font-bold text-white text-center">
                        {category.name}
                      </h2>
                    )}
                  </div>
                  
                  <div className="p-3">
                    <h2 className="text-base font-semibold mb-2 truncate">
                      {category.name}
                    </h2>
                    
                    <div className="flex justify-between">
                      <button
                        onClick={() => router.push(`/categories/${category.id}/edit`)}
                        className="flex items-center px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                      >
                        <FiEdit className="mr-1" size={12} />
                        Editar
                      </button>
                      
                      <button
                        onClick={() => handleDeleteCategory(category.id)}
                        className="flex items-center px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                        disabled={deleteLoading === category.id}
                      >
                        <FiTrash2 className="mr-1" size={12} />
                        {deleteLoading === category.id ? 'Excluindo...' : 'Excluir'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Layout>
    </>
  );
} 
