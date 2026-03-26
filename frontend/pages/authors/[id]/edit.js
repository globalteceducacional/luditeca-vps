import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import { FaArrowLeft, FaImage } from 'react-icons/fa';
import { useAuth } from '../../../contexts/auth';
import { getAuthor, updateAuthor } from '../../../lib/authors';
import { getFileUrl } from '../../../lib/mediaUrl';
import { uploadFile } from '../../../lib/storageApi';
import Layout from '../../../components/Layout';
import { ADMIN_ONLY, isRole } from '../../../lib/roles';

export default function EditAuthor() {
  const router = useRouter();
  const { id } = router.query;
  
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  
  const { user, loading: isLoading } = useAuth();

  // Verificar autenticação
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
    if (!isLoading && user && !isRole(user, ADMIN_ONLY)) {
      router.replace('/books');
    }
  }, [isLoading, user, router]);

  // Carregar dados do autor
  useEffect(() => {
    if (id && user) {
      fetchAuthor();
    }
  }, [id, user]);

  // Função para buscar dados do autor
  const fetchAuthor = async () => {
    try {
      setLoading(true);
      const { data, error } = await getAuthor(id);
      
      if (error) {
        throw error;
      }

      if (!data) {
        throw new Error('Autor não encontrado');
      }
      
      console.log('Dados do autor carregados:', data);
      
      // Definir dados nos estados
      setName(data.name || '');
      setBio(data.bio || '');
      
      // Processar URL da foto
      let photoUrlToUse = '';
      if (data.photo_url) {
        if (data.photo_url.startsWith('http')) {
          photoUrlToUse = data.photo_url;
        } else {
          photoUrlToUse = getFileUrl('authors', data.photo_url);
        }
      }
      
      console.log('URL da foto processada:', photoUrlToUse);
      setPhotoUrl(photoUrlToUse);
      
    } catch (err) {
      console.error('Erro ao carregar autor:', err);
      setError(err.message || 'Erro ao carregar o autor');
      toast.error(err.message || 'Erro ao carregar o autor');
    } finally {
      setLoading(false);
    }
  };

  // Função para upload direto da imagem
  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      if (!user?.id) throw new Error('Utilizador não autenticado');
      const fileExt = file.name.split('.').pop();
      // Enviar path relativo; o backend separa por usuário.
      const fileName = `autor_${id || 'edit'}_${Date.now()}.${fileExt}`;
      const { url } = await uploadFile('autores', fileName, file);
      setPhotoUrl(url);
      toast.success('Foto enviada com sucesso!');
    } catch (err) {
      setError('Erro ao fazer upload da foto');
      toast.error('Erro ao fazer upload da foto');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      // Validação básica
      if (!name.trim()) {
        throw new Error('O nome do autor é obrigatório');
      }

      const authorData = {
        name: name.trim(),
        bio: bio.trim() || null,
        photo_url: photoUrl
      };

      console.log('Enviando dados atualizados do autor:', authorData);
      
      const { data, error } = await updateAuthor(id, authorData);
      
      if (error) {
        console.error('Erro retornado pela função updateAuthor:', error);
        throw new Error(error.message || 'Erro ao atualizar o autor');
      }
      
      toast.success('Autor atualizado com sucesso!');
      router.push('/authors');
    } catch (err) {
      console.error('Exceção capturada no handleSubmit:', err);
      setError(err.message);
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };
  
  if (isLoading || loading) {
    return (
      <Layout>
        <div className="text-center p-8">Carregando...</div>
      </Layout>
    );
  }
  
  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <Link href="/authors" className="flex items-center text-blue-600 hover:text-blue-800">
            <FaArrowLeft className="mr-2" />
            Voltar para Autores
          </Link>
          <h1 className="text-2xl font-bold">Editar Autor</h1>
        </div>
        
        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="name">
              Nome do Autor*
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              required
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="bio">
              Biografia
            </label>
            <textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              rows="4"
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Foto do Autor
            </label>
            <div className="flex items-center gap-4">
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                disabled={uploading}
                className="block"
              />
              {uploading && <span className="text-blue-600 text-sm">Enviando...</span>}
              {photoUrl && (
                <div className="text-sm text-green-600">Imagem selecionada</div>
              )}
            </div>
            {photoUrl && (
              <div className="mt-4 border rounded p-4">
                <p className="text-sm text-gray-500 mb-2">Prévia:</p>
                <img src={photoUrl} alt="Foto do autor" className="max-h-48 object-contain" />
              </div>
            )}
          </div>
          
          <div className="flex items-center justify-between">
            <button
              type="submit"
              disabled={saving}
              className={`bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline ${
                saving ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}

export async function getServerSideProps({ params }) {
  return {
    props: {
      id: params?.id || null
    }
  };
} 