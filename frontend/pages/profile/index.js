import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { FiUser, FiMail, FiSave, FiLock, FiImage } from 'react-icons/fi';
import { useAuth } from '../../contexts/auth';
import Layout from '../../components/Layout';
import { apiFetch } from '../../lib/apiClient';
import { uploadFile } from '../../lib/storageApi';

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading, updateUserData } = useAuth();
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [photoPreview, setPhotoPreview] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  
  // Verificar autenticaÃ§Ã£o
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    } else if (user) {
      // Preencher os campos com os dados do usuÃ¡rio
      setEmail(user.email || '');
      setName(user.user_metadata?.name || user.name || '');
      if (user.user_metadata?.avatar_url) {
        setPhotoPreview(user.user_metadata.avatar_url);
      }
    }
  }, [loading, user, router]);
  
  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingAvatar(true);
      const { url } = await uploadFile('avatars', file.name, file);
      setPhotoPreview(url || '');
      setMessage({ type: 'success', text: 'Imagem enviada com sucesso!' });
    } catch (error) {
      setMessage({ type: 'error', text: error?.message || 'Falha no upload da imagem.' });
    } finally {
      setUploadingAvatar(false);
      e.target.value = '';
    }
  };
  
  const handleRemovePhoto = () => {
    setPhotoPreview('');
  };
  
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    
    try {
      setIsSaving(true);
      
      // Preparar dados do perfil
      await apiFetch('/auth/profile', {
        method: 'PATCH',
        body: {
          name: name.trim() || null,
          avatar_url: photoPreview || null,
        },
      });
      
      // Atualizar o contexto de autenticaÃ§Ã£o
      if (updateUserData) {
        await updateUserData();
      }
      
      setMessage({ 
        type: 'success', 
        text: 'Perfil atualizado com sucesso!' 
      });
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      setMessage({ 
        type: 'error', 
        text: `Falha ao atualizar o perfil: ${error.message}` 
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    
    if (newPassword !== confirmPassword) {
      setMessage({ 
        type: 'error', 
        text: 'As senhas nÃ£o coincidem.' 
      });
      return;
    }
    
    try {
      setIsSaving(true);

      await apiFetch('/auth/change-password', {
        method: 'POST',
        body: {
          currentPassword: currentPassword,
          newPassword: newPassword,
        },
      });
      
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      setMessage({ 
        type: 'success', 
        text: 'Senha alterada com sucesso!' 
      });
    } catch (error) {
      console.error('Erro ao alterar senha:', error);
      setMessage({ 
        type: 'error', 
        text: error.message || 'Falha ao alterar a senha. Verifique se a senha atual estÃ¡ correta.'
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Carregando dados do perfil...</div>
        </div>
      </Layout>
    );
  }
  
  return (
    <Layout>
      <Head>
        <title>Meu Perfil | Luditeca CMS</title>
      </Head>
      
      <div className="container mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-6">Meu Perfil</h1>
        
        {message.text && (
          <div className={`p-4 mb-6 rounded ${
            message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            {message.text}
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* InformaÃ§Ãµes de perfil */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4">InformaÃ§Ãµes de Perfil</h2>
            
            <form onSubmit={handleUpdateProfile}>
              {/* Foto de perfil */}
              <div className="mb-6 flex flex-col items-center">
                <div className="relative mb-3">
                  <div className="w-28 h-28 rounded-full overflow-hidden bg-gray-200 border">
                    {photoPreview ? (
                      <img 
                        src={photoPreview} 
                        alt="Preview" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-blue-600 text-white text-4xl font-semibold">
                        {name ? name.charAt(0).toUpperCase() : (email ? email.charAt(0).toUpperCase() : 'U')}
                      </div>
                    )}
                  </div>
                  <label className="absolute bottom-0 right-0 bg-white rounded-full p-2 border shadow-sm cursor-pointer hover:bg-gray-100">
                    <FiImage size={18} className="text-blue-600" />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarUpload}
                      disabled={uploadingAvatar}
                    />
                  </label>
                </div>
                {uploadingAvatar && (
                  <span className="text-sm text-blue-600">Enviando imagem...</span>
                )}
                
                {photoPreview && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="text-sm text-red-600 hover:text-red-700"
                  >
                    Remover foto
                  </button>
                )}
              </div>
              
              <div className="mb-4">
                <label htmlFor="name" className="block text-gray-700 text-sm font-bold mb-2">
                  Nome completo
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FiUser className="text-gray-400" />
                  </div>
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-10 shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    placeholder="Seu nome completo"
                  />
                </div>
              </div>
              
              <div className="mb-6">
                <label htmlFor="email" className="block text-gray-700 text-sm font-bold mb-2">
                  Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FiMail className="text-gray-400" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    disabled
                    className="pl-10 shadow appearance-none border rounded w-full py-2 px-3 text-gray-500 bg-gray-100 leading-tight"
                    placeholder="seu@email.com"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">O email nÃ£o pode ser alterado</p>
              </div>
              
              <button
                type="submit"
                disabled={isSaving}
                className={`flex items-center justify-center w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline ${
                  isSaving ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {isSaving ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Salvando...
                  </>
                ) : (
                  <>
                    <FiSave className="mr-2" />
                    Salvar AlteraÃ§Ãµes
                  </>
                )}
              </button>
            </form>
          </div>
          
          {/* AlteraÃ§Ã£o de senha */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4">Alterar Senha</h2>
            
            <form onSubmit={handleChangePassword}>
              <div className="mb-4">
                <label htmlFor="current-password" className="block text-gray-700 text-sm font-bold mb-2">
                  Senha atual
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FiLock className="text-gray-400" />
                  </div>
                  <input
                    id="current-password"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="pl-10 shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    placeholder="Sua senha atual"
                    required
                  />
                </div>
              </div>
              
              <div className="mb-4">
                <label htmlFor="new-password" className="block text-gray-700 text-sm font-bold mb-2">
                  Nova senha
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FiLock className="text-gray-400" />
                  </div>
                  <input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pl-10 shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    placeholder="Nova senha"
                    required
                  />
                </div>
              </div>
              
              <div className="mb-6">
                <label htmlFor="confirm-password" className="block text-gray-700 text-sm font-bold mb-2">
                  Confirmar nova senha
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FiLock className="text-gray-400" />
                  </div>
                  <input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10 shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    placeholder="Confirme a nova senha"
                    required
                  />
                </div>
              </div>
              
              <button
                type="submit"
                disabled={isSaving}
                className={`flex items-center justify-center w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline ${
                  isSaving ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {isSaving ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Salvando...
                  </>
                ) : (
                  <>
                    <FiSave className="mr-2" />
                    Alterar Senha
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </Layout>
  );
} 
