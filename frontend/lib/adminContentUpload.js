import { uploadFile } from './storageApi';

/**
 * Upload de imagem para conteúdo admin (puzzle, pinturas, etc.).
 * Usa bucket `pages` com prefixo dedicado por tipo.
 */
export async function uploadAdminContentImage(file, kind) {
  if (!file || !file.type?.startsWith('image/')) {
    throw new Error('Selecione um ficheiro de imagem (PNG, JPG, GIF, WebP).');
  }
  const ext = (file.name.split('.').pop() || 'png').replace(/[^\w]/g, '');
  const safeKind = String(kind || 'content').replace(/[^\w-]/g, '');
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
  const path = `admin-content/${safeKind}/${fileName}`;
  const { url } = await uploadFile('pages', path, file);
  if (!url) throw new Error('Upload concluído mas sem URL devolvida.');
  return url;
}
