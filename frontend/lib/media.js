import { getFileUrl } from './mediaUrl';
import { storageList, storageUpload, storageDeleteObject } from './storageApi';

function mapListItem(bucket, item) {
  const path = item.path;
  const url =
    item.url ||
    (item.type === 'image' || item.type === 'gif' ? getFileUrl(bucket, path) : item.url);
  return {
    id: item.id,
    name: item.name,
    path,
    type: item.type,
    url,
    metadata: item.metadata,
    updated_at: item.updated_at,
  };
}

export const listAudios = async (path = '') => {
  try {
    const data = await storageList('audios', path);
    const processedFiles = data
      .filter((item) => item.type !== 'folder')
      .map((item) => mapListItem('audios', item));
    return { data: processedFiles, error: null };
  } catch (error) {
    console.error('Erro ao listar arquivos de áudio:', error);
    return { data: null, error };
  }
};

export const listCovers = async (path = '') => {
  try {
    const data = await storageList('covers', path);
    const processedFiles = data
      .filter((item) => item.type !== 'folder')
      .map((item) => mapListItem('covers', item));
    return { data: processedFiles, error: null };
  } catch (error) {
    console.error('Erro ao listar capas:', error);
    return { data: null, error };
  }
};

export const listPages = async (path = '') => {
  try {
    const data = await storageList('pages', path);
    const processedFiles = data
      .filter((item) => item.type !== 'folder')
      .map((item) => mapListItem('pages', item));
    return { data: processedFiles, error: null };
  } catch (error) {
    console.error('Erro ao listar páginas:', error);
    return { data: null, error };
  }
};

export const uploadAudio = async (file, path) => {
  try {
    const data = await storageUpload('audios', path, file);
    return { data: { ...data, url: data.url }, error: null };
  } catch (error) {
    console.error('Erro ao fazer upload de áudio:', error);
    return { data: null, error };
  }
};

export const uploadCover = async (file, path) => {
  try {
    const data = await storageUpload('covers', path, file);
    return { data: { ...data, url: data.url }, error: null };
  } catch (error) {
    console.error('Erro ao fazer upload de capa:', error);
    return { data: null, error };
  }
};

export const uploadPage = async (file, path) => {
  try {
    const data = await storageUpload('pages', path, file);
    return { data: { ...data, url: data.url }, error: null };
  } catch (error) {
    console.error('Erro ao fazer upload de página:', error);
    return { data: null, error };
  }
};

export const deleteAudio = async (path) => {
  try {
    await storageDeleteObject('audios', path);
    return { data: null, error: null };
  } catch (error) {
    console.error('Erro ao excluir áudio:', error);
    return { data: null, error };
  }
};

export const deleteCover = async (path) => {
  try {
    await storageDeleteObject('covers', path);
    return { data: null, error: null };
  } catch (error) {
    console.error('Erro ao excluir capa:', error);
    return { data: null, error };
  }
};

export const deletePage = async (path) => {
  try {
    await storageDeleteObject('pages', path);
    return { data: null, error: null };
  } catch (error) {
    console.error('Erro ao excluir página:', error);
    return { data: null, error };
  }
};
