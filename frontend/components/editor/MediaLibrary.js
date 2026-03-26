import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FiFolder, FiImage, FiMusic, FiVideo, FiFile, FiFilePlus, FiTrash2, FiArrowLeft, FiSearch, FiUpload, FiPlusCircle, FiMove, FiRefreshCw } from 'react-icons/fi';
import { useAuth } from '../../contexts/auth';
import { getApiBaseUrl } from '../../lib/apiClient';
import {
  storageListWithRoot,
  storageDeleteObjectWithRoot,
  storageCreateFolderWithRoot,
  storageUploadWithProgressAndRoot,
  storageMoveWithRoot,
  storageMetadata,
} from '../../lib/storageApi';

// Cache para armazenar os metadados dos arquivos
const fileMetadataCache = new Map();
const CACHE_EXPIRATION = 5 * 60 * 1000; // 5 minutos

// Mapeamento de tipos de mídia para buckets
const BUCKET_MAP = {
  'image': 'covers',
  'cover': 'covers',
  'background': 'covers',
  'audio': 'audios',
  'video': 'videos',
  'page': 'pages',
  'category': 'categories',
  'author': 'autores'
};

const MediaLibrary = ({ onSelect, mediaType = 'image', bookId = null, bucketOverride = null }) => {
  const { user } = useAuth();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentFolder, setCurrentFolder] = useState('');
  const [breadcrumbs, setBreadcrumbs] = useState([{ name: 'Root', path: '' }]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [showFolderForm, setShowFolderForm] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState({});
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [targetFolder, setTargetFolder] = useState('');
  const [availableFolders, setAvailableFolders] = useState([]);
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const [isUploading, setIsUploading] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState([]);
  
  // Determine which bucket to use based on media type
  const bucketName = bucketOverride || BUCKET_MAP[mediaType] || 'covers';
  const root = 'library';
  const rootHeaders = useMemo(() => (bookId ? { 'x-book-id': String(bookId) } : {}), [bookId]);
  const apiBaseUrl = getApiBaseUrl();

  // Agora o backend aplica isolamento por usuário.
  // O frontend trabalha com `currentFolder` totalmente relativo (sem prefixar user.id).
  const effectiveCurrentFolder = useMemo(() => currentFolder, [currentFolder]);

  // Função para limpar o cache
  const clearCache = useCallback(() => {
    fileMetadataCache.clear();
  }, []);

  // Função para verificar se o cache está expirado
  const isCacheExpired = useCallback(() => {
    return Date.now() - lastRefresh > CACHE_EXPIRATION;
  }, [lastRefresh]);

  // Função para obter metadados do cache ou do banco
  const getFileMetadata = useCallback(async (filePath) => {
    if (!user) return null;

    const cacheKey = `${user.id}-${bucketName}-${filePath}`;
    const cachedData = fileMetadataCache.get(cacheKey);

    if (cachedData && !isCacheExpired()) {
      return cachedData;
    }

    try {
      const data = await storageMetadata(bucketName, filePath);
      if (data) {
        fileMetadataCache.set(cacheKey, data);
      }
      return data;
    } catch (e) {
      console.error('Erro ao buscar metadados:', e);
      return null;
    }
  }, [user, isCacheExpired, bucketName]);

  // Load files when component mounts or folder/bucket changes
  useEffect(() => {
    if (user) {
      loadFiles();
    }
  }, [effectiveCurrentFolder, bucketName, mediaType, user]);

  // Function to load files from Supabase storage
  const loadFiles = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const data = await storageListWithRoot(bucketName, {
        path: effectiveCurrentFolder,
        root,
        headers: rootHeaders,
      });

      const processedFiles = await Promise.all(
        data.map(async (item) => {
          if (item.type === 'folder') {
            return {
              id: null,
              name: item.name,
              type: 'folder',
              path: item.path,
            };
          }

          const filePath = item.path;
          const metadata =
            item.metadata ||
            (await getFileMetadata(filePath));

          return {
            id: item.id,
            name: item.name,
            type: item.type,
            url: item.url,
            directUrl:
              item.path
                ? `${apiBaseUrl}/media/${encodeURIComponent(bucketName)}/${item.path
                    .split('/')
                    .map((segment) => encodeURIComponent(segment))
                    .join('/')}`
                : null,
            path: filePath,
            metadata: metadata || null,
            user_id: user.id,
            updated_at: item.updated_at,
          };
        }),
      );

      // O backend já isola por usuário
      setFiles(processedFiles);
      setLastRefresh(Date.now());
    } catch (err) {
      console.error('Error loading files:', err);
      setError(`Failed to load files: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Função para atualizar a lista de arquivos
  const refreshFiles = useCallback(() => {
    clearCache();
    loadFiles();
  }, [clearCache, loadFiles]);

  // Handle file delete
  const handleDeleteFile = async (file) => {
    if (!user) return;
    if (!confirm(`Are you sure you want to delete ${file.name}?`)) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Delete file from storage
      await storageDeleteObjectWithRoot(bucketName, { path: file.path, root, headers: rootHeaders });

      // Reload files after deletion
      loadFiles();
    } catch (err) {
      console.error('Error deleting file:', err);
      setError(`Failed to delete file: ${err.message}`);
      setLoading(false);
    }
  };

  // Navigate to a folder
  const goToFolder = (folderPath) => {
    setCurrentFolder(folderPath);
    
    // Update breadcrumbs
    const pathParts = folderPath.split('/').filter(Boolean);
    const newBreadcrumbs = [{ name: 'Root', path: '' }];
    
    let currentPath = '';
    pathParts.forEach(part => {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      newBreadcrumbs.push({ name: part, path: currentPath });
    });
    
    setBreadcrumbs(newBreadcrumbs);
  };

  // Go back to parent folder
  const goBack = () => {
    if (currentFolder === '') return;
    
    const pathParts = currentFolder.split('/').filter(Boolean);
    pathParts.pop();
    const parentFolder = pathParts.join('/');
    
    setCurrentFolder(parentFolder);
    setBreadcrumbs(breadcrumbs.slice(0, -1));
  };

  // Handle file selection
  const handleSelect = (file) => {
    if (file.type === 'folder') {
      goToFolder(file.path);
    } else {
      setSelectedFile(file.id);
      // Removida a chamada automática de onSelect
    }
  };

  // Handle file confirmation
  const handleConfirmSelection = () => {
    if (selectedFile) {
      const file = files.find(f => f.id === selectedFile);
      if (file && onSelect && file.url) {
        console.log("MediaLibrary: handleConfirmSelection - Selected file:", file);
        onSelect(file);
      }
    }
  };
  
  // Handle double click selection
  const handleDoubleClick = (file) => {
    if (file.type !== 'folder') {
      setSelectedFile(file.id);
      if (onSelect && file.url) {
        console.log("MediaLibrary: handleDoubleClick - Selected file:", file);
        onSelect(file);
      }
    } else {
      goToFolder(file.path);
    }
  };

  // Handle create folder
  const handleCreateFolder = async (e) => {
    e.preventDefault();
    
    if (!newFolderName.trim()) {
      setError('Folder name cannot be empty');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const folderPath = effectiveCurrentFolder
        ? `${effectiveCurrentFolder}/${newFolderName}`
        : `${newFolderName}`;

      await storageCreateFolderWithRoot(bucketName, {
        folderPath: folderPath.replace(/\/$/, ''),
        root,
        headers: rootHeaders,
      });

      setNewFolderName('');
      setShowFolderForm(false);
      loadFiles();
    } catch (err) {
      console.error('Error creating folder:', err);
      setError(`Failed to create folder: ${err.message}`);
      setLoading(false);
    }
  };

  // Handle file upload
  const handleFileUpload = async (e) => {
    if (!user) return;

    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setIsUploading(true);
      setError(null);
      setUploadingFiles(Array.from(files).map(file => ({
        name: file.name,
        progress: 0
      })));

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Verificar tamanho do arquivo para áudio e vídeo
        if (mediaType === 'audio' && file.size > 50 * 1024 * 1024) { // 50MB
          throw new Error(`O arquivo ${file.name} excede o limite de 50MB permitido para áudios.`);
        }
        if (mediaType === 'video' && file.size > 100 * 1024 * 1024) { // 100MB
          throw new Error(`O arquivo ${file.name} excede o limite de 100MB permitido para vídeos.`);
        }

        const filePath = effectiveCurrentFolder ? `${effectiveCurrentFolder}` : '';

        await storageUploadWithProgressAndRoot(bucketName, {
          path: filePath,
          file,
          root,
          headers: rootHeaders,
          onProgress: (percent) => {
            setUploadingFiles((prev) =>
              prev.map((f) => (f.name === file.name ? { ...f, progress: percent } : f)),
            );
          },
        });
      }

      // Reload files after upload
      loadFiles();
    } catch (err) {
      console.error('Error uploading file:', err);
      setError(`Falha ao fazer upload do arquivo: ${err.message}`);
    } finally {
      setIsUploading(false);
      setUploadingFiles([]);
    }
  };

  // Filter files based on search query
  const filteredFiles = files.filter(file => {
    if (!searchQuery) return true;
    return file.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Group files by type
  const groupedFiles = {
    folders: [],
    images: [],
    gifs: [],
    audio: [],
    video: [],
    documents: [],
    other: []
  };

  filteredFiles.forEach(file => {
    if (file.type === 'folder') {
      groupedFiles.folders.push(file);
    } else if (file.type === 'gif') {
      groupedFiles.gifs.push(file);
    } else if (file.type === 'image') {
      groupedFiles.images.push(file);
    } else if (file.type === 'audio') {
      groupedFiles.audio.push(file);
    } else if (file.type === 'video') {
      groupedFiles.video.push(file);
    } else if (file.type === 'document') {
      groupedFiles.documents.push(file);
    } else {
      groupedFiles.other.push(file);
    }
  });

  // Get appropriate icon for file type
  const getFileIcon = (type) => {
    switch (type) {
      case 'folder':
        return <FiFolder className="text-yellow-500" />;
      case 'image':
        return <FiImage className="text-green-500" />;
      case 'audio':
        return <FiMusic className="text-blue-500" />;
      case 'video':
        return <FiVideo className="text-purple-500" />;
      case 'document':
        return <FiFile className="text-yellow-500" />;
      default:
        return <FiFile className="text-gray-500" />;
    }
  };

  const getMediaTypeTitle = () => {
    switch (mediaType) {
      case 'image':
      case 'background':
      case 'cover':
        return 'Selecionar Imagem';
      case 'audio':
        return 'Selecionar Áudio';
      case 'page':
        return 'Selecionar Imagem de Página';
      case 'category':
        return 'Selecionar Imagem de Categoria';
      case 'author':
        return 'Selecionar Foto de Autor';
      default:
        return 'Biblioteca de Mídia';
    }
  };

  // Determinar quais tipos de arquivos são aceitos para upload
  const getAcceptTypes = () => {
    switch (mediaType) {
      case 'image':
      case 'background':
      case 'cover':
      case 'category':
      case 'author':
      case 'page':
        return "image/*,.gif";
      case 'audio':
        return "audio/*";
      case 'video':
        return "video/*";
      default:
        return "image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.gif";
    }
  };

  // Função para carregar todas as pastas disponíveis
  const loadAvailableFolders = async () => {
    try {
      const data = await storageListWithRoot(bucketName, { path: '', root, headers: rootHeaders });

      const folders = data
        .filter((item) => item.type === 'folder')
        .map((folder) => ({
          name: folder.name,
          path: folder.path,
        }));

      setAvailableFolders(folders);
    } catch (err) {
      console.error('Erro ao carregar pastas:', err);
      setError(`Falha ao carregar pastas: ${err.message}`);
    }
  };

  // Função para mover arquivo
  const handleMoveFile = async () => {
    if (!selectedFile || !targetFolder) return;

    try {
      setLoading(true);
      setError(null);

      const file = files.find(f => f.id === selectedFile);
      if (!file) throw new Error('Arquivo não encontrado');

      const newPath = targetFolder ? `${targetFolder}/${file.name}` : `${file.name}`;

      await storageMoveWithRoot(bucketName, { from: file.path, to: newPath, root, headers: rootHeaders });

      setShowMoveDialog(false);
      setTargetFolder('');
      loadFiles();
    } catch (err) {
      console.error('Erro ao mover arquivo:', err);
      setError(`Falha ao mover arquivo: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Carregar pastas quando o diálogo de movimentação é aberto
  useEffect(() => {
    if (showMoveDialog) {
      loadAvailableFolders();
    }
  }, [showMoveDialog]);

  // Função para formatar o tamanho do arquivo
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Função para formatar a data
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  // Função para pré-visualizar arquivos
  const renderFilePreview = (file) => {
    const imageSrc = file.url || file.directUrl || '';

    switch (file.type) {
      case 'image':
      case 'gif':
        return (
          <div className="relative group">
            <img 
              src={imageSrc}
              alt={file.name}
              className="object-cover w-full h-full"
              onError={(e) => {
                if (file.directUrl && e.currentTarget.src !== file.directUrl) {
                  e.currentTarget.src = file.directUrl;
                }
              }}
            />
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-white text-xs">
                {formatFileSize(file.metadata?.file_size || 0)}
              </div>
            </div>
          </div>
        );
      case 'audio':
        return (
          <div className="flex items-center justify-center w-full h-full bg-gray-100">
            <audio 
              src={file.url} 
              controls 
              className="w-full"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        );
      case 'video':
        return (
          <div className="relative group">
            <video 
              src={file.url} 
              className="w-full h-full object-cover"
              controls
              onClick={(e) => e.stopPropagation()}
            />
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-white text-xs">
                {formatFileSize(file.metadata?.file_size || 0)}
              </div>
            </div>
          </div>
        );
      default:
        return (
          <div className="flex items-center justify-center w-full h-full bg-gray-100">
            {getFileIcon(file.type)}
          </div>
        );
    }
  };

  // Função para renderizar informações do arquivo
  const renderFileInfo = (file) => {
    if (file.type === 'folder') return null;

    return (
      <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white p-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <div className="truncate">{file.name}</div>
        <div className="flex justify-between text-gray-300">
          <span>{formatFileSize(file.metadata?.file_size || 0)}</span>
          <span>{formatDate(file.metadata?.created_at)}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-white rounded-lg shadow overflow-hidden">
      <div className="flex-shrink-0 p-4 space-y-4 border-b border-gray-100">
      <div className="flex justify-between items-center gap-2 flex-wrap">
        <h3 className="text-lg font-medium">{getMediaTypeTitle()} - Bucket: {bucketName}</h3>
        <div className="flex space-x-2">
          <button
            onClick={refreshFiles}
            className="px-2 py-1 bg-gray-100 rounded text-sm hover:bg-gray-200 flex items-center"
            title="Atualizar lista"
          >
            <FiRefreshCw className="mr-1" /> Atualizar
          </button>
          <button
            onClick={() => setShowFolderForm(true)}
            className="px-2 py-1 bg-gray-100 rounded text-sm hover:bg-gray-200 flex items-center"
          >
            <FiFolder className="mr-1" /> Nova Pasta
          </button>
          <button
            onClick={() => setShowUploadForm(true)}
            className="px-2 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 flex items-center"
          >
            <FiUpload className="mr-1" /> Upload
          </button>
        </div>
      </div>

      {/* Breadcrumbs navigation */}
      <div className="flex items-center space-x-1 text-sm overflow-x-auto">
        {currentFolder && (
          <button 
            onClick={goBack}
            className="p-1 text-gray-500 hover:text-gray-700"
          >
            <FiArrowLeft />
          </button>
        )}
        
        {breadcrumbs.map((crumb, index) => (
          <React.Fragment key={crumb.path}>
            {index > 0 && <span className="text-gray-400">/</span>}
            <button
              onClick={() => goToFolder(crumb.path)}
              className={`hover:underline px-1 ${index === breadcrumbs.length - 1 ? 'font-medium' : ''}`}
            >
              {crumb.name}
            </button>
          </React.Fragment>
        ))}
      </div>

      {/* New Folder Form */}
      {showFolderForm && (
        <div className="bg-gray-50 p-3 rounded">
          <form onSubmit={handleCreateFolder} className="flex flex-col space-y-2">
            <label className="text-sm font-medium">
              Nome da Nova Pasta
              <input
                type="text"
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                className="w-full mt-1 p-1 border border-gray-300 rounded text-sm"
                placeholder="Digite o nome da pasta"
                autoFocus
              />
            </label>
            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowFolderForm(false)}
                className="px-2 py-1 border border-gray-300 rounded text-sm hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-2 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
              >
                Criar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Upload Form */}
      {showUploadForm && (
        <div className="bg-gray-50 p-3 rounded">
          <div className="flex flex-col space-y-2">
            <label className={`text-sm font-medium flex items-center justify-center p-6 border-2 border-dashed ${isUploading ? 'border-gray-400 bg-gray-100' : 'border-gray-300 hover:bg-gray-100'} rounded-lg cursor-pointer`}>
              <div className="text-center">
                {isUploading ? (
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-2"></div>
                    <span className="text-sm text-gray-600">Enviando arquivos...</span>
                  </div>
                ) : (
                  <>
                <FiPlusCircle className="mx-auto h-8 w-8 text-gray-400" />
                <span className="mt-2 block text-sm font-medium text-gray-700">
                  Clique para fazer upload de arquivos
                </span>
                  </>
                )}
              </div>
              <input
                type="file"
                multiple
                accept={getAcceptTypes()}
                onChange={handleFileUpload}
                className="hidden"
                disabled={isUploading}
              />
            </label>

            {/* Progress bars for uploading files */}
            {isUploading && uploadingFiles.length > 0 && (
              <div className="space-y-2">
                {uploadingFiles.map((file, index) => (
                  <div key={index} className="space-y-1">
                    <div className="flex justify-between text-xs text-gray-600">
                      <span className="truncate">{file.name}</span>
                      <span>{file.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div 
                        className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${file.progress}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="text-xs text-gray-500 text-center">
              {mediaType === 'image' || mediaType === 'background' ? 'Suporta imagens e GIFs' : 
               mediaType === 'audio' ? 'Suporta arquivos de áudio (MP3, WAV, OGG) até 50MB' :
               mediaType === 'video' ? 'Suporta vídeos até 100MB' :
               'Suporta múltiplos tipos de arquivos'}
            </div>
            <button
              onClick={() => setShowUploadForm(false)}
              className="px-2 py-1 border border-gray-300 rounded text-sm hover:bg-gray-100"
              disabled={isUploading}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col space-y-4">
        <div className="relative">
          <input
            type="text"
            placeholder="Buscar arquivos..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-2 py-1 border border-gray-300 rounded text-sm"
          />
          <FiSearch className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
        </div>
      </div>

      {error && (
        <div className="bg-red-100 text-red-700 p-3 rounded">
          {error}
        </div>
      )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4">
      {loading && filteredFiles.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          Carregando...
        </div>
      ) : filteredFiles.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          <FiFile className="mx-auto h-12 w-12 text-gray-400 mb-2" />
          <p>Nenhum arquivo encontrado.</p>
          <p className="text-sm text-gray-400 mt-1">
            {searchQuery ? 'Tente uma busca diferente' : 'Faça upload de arquivos ou crie uma pasta'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Folders */}
          {groupedFiles.folders.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-700 mb-2">Pastas</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {groupedFiles.folders.map(folder => (
                  <div 
                    key={folder.id || folder.name}
                    onClick={() => goToFolder(folder.path)}
                    className="flex items-center p-2 bg-gray-50 rounded hover:bg-gray-100 cursor-pointer group"
                  >
                    <FiFolder className="mr-2 text-yellow-500" />
                    <span className="truncate text-sm">{folder.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Images and GIFs */}
          {(groupedFiles.images.length > 0 || groupedFiles.gifs.length > 0) && (
            <div>
              <h4 className="font-medium text-gray-700 mb-2">Imagens</h4>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                {[...groupedFiles.images, ...groupedFiles.gifs].map(file => (
                  <div 
                    key={file.id || file.name}
                    className={`relative group rounded border ${selectedFile === file.id ? 'border-blue-500 ring-2 ring-blue-300' : 'border-gray-200'} overflow-hidden`}
                  >
                    <div 
                      className="aspect-square bg-gray-100 overflow-hidden cursor-pointer"
                      onClick={() => handleSelect(file)}
                      onDoubleClick={() => handleDoubleClick(file)}
                    >
                      {renderFilePreview(file)}
                    </div>
                    {renderFileInfo(file)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Audio files */}
          {groupedFiles.audio.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-700 mb-2">Áudios</h4>
              <div className="space-y-1">
                {groupedFiles.audio.map(file => (
                  <div 
                    key={file.id || file.name}
                    className={`flex items-center justify-between p-2 ${selectedFile === file.id ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50 hover:bg-gray-100'} rounded cursor-pointer group`}
                    onClick={() => handleSelect(file)}
                    onDoubleClick={() => handleDoubleClick(file)}
                  >
                    <div className="flex items-center space-x-2 truncate">
                      <FiMusic className="text-blue-500" />
                      <div className="flex flex-col">
                        <span className="truncate text-sm">{file.name}</span>
                        <span className="text-xs text-gray-500">
                          {formatFileSize(file.metadata?.file_size || 0)} • {formatDate(file.metadata?.created_at)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <audio 
                        src={file.url} 
                        controls 
                        className="h-8 w-40 mx-2"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Video files */}
          {groupedFiles.video.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-700 mb-2">Vídeos</h4>
              <div className="space-y-1">
                {groupedFiles.video.map(file => (
                  <div 
                    key={file.id || file.name}
                    className={`flex items-center justify-between p-2 ${selectedFile === file.id ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50 hover:bg-gray-100'} rounded cursor-pointer group`}
                    onClick={() => handleSelect(file)}
                    onDoubleClick={() => handleDoubleClick(file)}
                  >
                    <div className="flex items-center space-x-2 truncate">
                      <FiVideo className="text-purple-500" />
                      <div className="flex flex-col">
                        <span className="truncate text-sm">{file.name}</span>
                        <span className="text-xs text-gray-500">
                          {formatFileSize(file.metadata?.file_size || 0)} • {formatDate(file.metadata?.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Other file types */}
          {['documents', 'other'].map(fileGroup => {
            const files = groupedFiles[fileGroup];
            if (files.length === 0) return null;
            
            return (
              <div key={fileGroup}>
                <h4 className="font-medium text-gray-700 mb-2 capitalize">{fileGroup}</h4>
                <div className="space-y-1">
                  {files.map(file => (
                    <div 
                      key={file.id || file.name}
                      className={`flex items-center justify-between p-2 ${selectedFile === file.id ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50 hover:bg-gray-100'} rounded cursor-pointer group`}
                      onClick={() => handleSelect(file)}
                      onDoubleClick={() => handleDoubleClick(file)}
                    >
                      <div className="flex items-center space-x-2 truncate">
                        {getFileIcon(file.type)}
                        <div className="flex flex-col">
                          <span className="truncate text-sm">{file.name}</span>
                          <span className="text-xs text-gray-500">
                            {formatFileSize(file.metadata?.file_size || 0)} • {formatDate(file.metadata?.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

        </div>
      )}
      </div>

      {selectedFile && (
        <div className="flex-shrink-0 flex flex-wrap items-center justify-center gap-2 p-4 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={() => {
              const file = files.find(f => f.id === selectedFile);
              if (file) handleDeleteFile(file);
            }}
            className="bg-red-600 text-white px-4 py-2 rounded shadow-sm hover:bg-red-700 transition-colors flex items-center"
          >
            <FiTrash2 className="mr-2" /> Excluir
          </button>
          <button
            type="button"
            onClick={() => setShowMoveDialog(true)}
            className="bg-yellow-600 text-white px-4 py-2 rounded shadow-sm hover:bg-yellow-700 transition-colors flex items-center"
          >
            <FiMove className="mr-2" /> Mover
          </button>
          <button
            type="button"
            onClick={handleConfirmSelection}
            className="bg-blue-600 text-white px-4 py-2 rounded shadow-sm hover:bg-blue-700 transition-colors"
          >
            Confirmar seleção
          </button>
        </div>
      )}

      {showMoveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
          <div className="bg-white rounded-lg p-6 w-96 max-w-[calc(100vw-2rem)] shadow-xl">
            <h3 className="text-lg font-medium mb-4">Mover Arquivo</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Pasta de Destino
              </label>
              <select
                value={targetFolder}
                onChange={(e) => setTargetFolder(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2"
              >
                <option value="">Raiz</option>
                {availableFolders.map(folder => (
                  <option key={folder.path} value={folder.path}>
                    {folder.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => {
                  setShowMoveDialog(false);
                  setTargetFolder('');
                }}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleMoveFile}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Mover
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MediaLibrary; 