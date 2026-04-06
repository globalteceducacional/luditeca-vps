import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'react-hot-toast';
import {
  FiCheckSquare,
  FiEdit2,
  FiImage,
  FiMusic,
  FiPlus,
  FiTrash2,
  FiUploadCloud,
  FiVideo,
  FiSave,
  FiX,
} from 'react-icons/fi';
import {
  storageDeleteObjectWithRoot,
  storageListWithRoot,
  storageRenameWithRoot,
  storageReplaceWithRoot,
  storageUploadWithProgressAndRoot,
} from '../../../lib/storageApi';
import { getApiBaseUrl } from '../../../lib/apiClient';

function getBackgroundUrl(page) {
  const bg = page?.background;
  if (!bg) return '';
  if (typeof bg === 'string') return bg;
  return typeof bg.url === 'string' ? bg.url : '';
}

function isGifUrl(url) {
  const s = String(url || '');
  return /\.gif(?:$|[?#])/i.test(s);
}

function getAcceptFromMediaType(type) {
  if (type === 'video') return 'video/*,.mp4,.webm,.mov,.m4v';
  return type === 'audio'
    ? 'audio/*,.mp3,.wav,.ogg,.m4a'
    : 'image/*,image/gif,.gif,.webp,.png,.jpg,.jpeg';
}

/** Chave real no storage (listagem por livro); `path` sozinho costuma ser só o nome do ficheiro. */
function libraryItemBusyKey(item) {
  const k = typeof item?.storageKey === 'string' ? item.storageKey.trim() : '';
  const p = typeof item?.path === 'string' ? item.path.trim() : '';
  return k || p || String(item?.id || '');
}

function splitFileNameParts(name) {
  const clean = String(name || '').trim();
  const idx = clean.lastIndexOf('.');
  if (idx <= 0) return { stem: clean || 'arquivo', ext: '' };
  return { stem: clean.slice(0, idx), ext: clean.slice(idx) };
}

function sanitizeMediaNameStem(name) {
  return String(name || '')
    .trim()
    .replace(/[^\w.\-() ]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 100);
}

function clampCropPercent(value, min = 0, max = 100) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function normalizeCropRect(rect) {
  const x = clampCropPercent(rect?.x, 0, 99);
  const y = clampCropPercent(rect?.y, 0, 99);
  const width = clampCropPercent(rect?.width, 1, 100 - x);
  const height = clampCropPercent(rect?.height, 1, 100 - y);
  return { x, y, width, height };
}

function getItemObjectKey(item) {
  return typeof item?.storageKey === 'string' && item.storageKey.trim() ? item.storageKey.trim() : '';
}

function buildRenamedFileName(item, nextStem) {
  const { ext } = splitFileNameParts(item?.name || '');
  const safeStem = sanitizeMediaNameStem(splitFileNameParts(nextStem).stem);
  if (!safeStem) return '';
  return `${safeStem}${ext}`;
}

function mimeFromImageName(name) {
  const ext = splitFileNameParts(name).ext.toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

function GifStillThumb({ url, className = '' }) {
  const [stillUrl, setStillUrl] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setStillUrl(null);
    if (!url || !isGifUrl(url)) return () => {};

    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const w = 256;
        const h = Math.round((w * 9) / 16);
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, w, h);
        const png = canvas.toDataURL('image/png');
        if (!cancelled) setStillUrl(png);
      } catch {
        if (!cancelled) setStillUrl('');
      }
    };
    img.onerror = () => {
      if (!cancelled) setStillUrl('');
    };
    img.src = url;

    return () => {
      cancelled = true;
    };
  }, [url]);

  if (stillUrl) {
    return (
      <img
        src={stillUrl}
        alt=""
        className={`h-full w-full object-cover ${className}`}
        draggable={false}
      />
    );
  }

  return (
    <div
      className={`flex h-full w-full items-center justify-center bg-slate-900 ${className}`}
    >
      <div className="flex items-center gap-2 px-2 text-center">
        <FiImage size={32} className="text-slate-200/90" />
      </div>
    </div>
  );
}

function getPagePreviewUrl(page) {
  const bgUrl = getBackgroundUrl(page);
  if (bgUrl && !isGifUrl(bgUrl)) return bgUrl;
  const nodes = Array.isArray(page?.nodes) ? page.nodes : [];
  const imageNodes = nodes
    .filter((n) => n?.type === 'image' && typeof n?.props?.content === 'string' && n.props.content.trim())
    .sort((a, b) => Number(a?.zIndex || 0) - Number(b?.zIndex || 0));

  const firstNonGifImage = imageNodes.find((n) => !isGifUrl(n?.props?.content));
  if (firstNonGifImage?.props?.content) return firstNonGifImage.props.content;

  // Se o fundo for GIF, ou só há GIF por cima, congelamos o GIF no thumbnail.
  if (bgUrl && isGifUrl(bgUrl)) return bgUrl;

  return imageNodes[0]?.props?.content || '';
}

export default function PageSidebar({
  pages = [],
  currentPage = 0,
  onSelectPage,
  onAddPage,
  onDeletePage,
  activeTab = 'pages',
  onTabChange,
  mediaType = 'image',
  onMediaTypeChange,
  bookId,
  onSelectMedia,
  onSelectTransitionBetweenPages,
  showTabs = true,
}) {
  const [mediaItems, setMediaItems] = useState([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [processingPath, setProcessingPath] = useState('');
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  /** Item da biblioteca em substituição (modal); não confundir com upload novo. */
  const [replaceTarget, setReplaceTarget] = useState(null);
  const replaceFileInputRef = useRef(null);
  const cropPreviewCanvasRef = useRef(null);
  const [renameValue, setRenameValue] = useState('');
  const [editorBusy, setEditorBusy] = useState('');
  const [editorImageSrc, setEditorImageSrc] = useState('');
  const [editorImageError, setEditorImageError] = useState('');
  const [editorImageMeta, setEditorImageMeta] = useState({ width: 0, height: 0 });
  const [cropRect, setCropRect] = useState({ x: 0, y: 0, width: 100, height: 100 });
  const apiBaseUrl = getApiBaseUrl();

  const replaceIsVideo = replaceTarget?.type === 'video';
  const replaceIsGif =
    replaceTarget?.type === 'gif' || isGifUrl(replaceTarget?.name || replaceTarget?.url);
  const replaceIsStaticImage =
    Boolean(replaceTarget) && !replaceIsVideo && !replaceIsGif && replaceTarget?.type !== 'audio';

  useEffect(() => {
    if (!replaceTarget) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setReplaceTarget(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [replaceTarget]);

  useEffect(() => {
    if (!replaceTarget) {
      setRenameValue('');
      setEditorBusy('');
      setEditorImageSrc('');
      setEditorImageError('');
      setEditorImageMeta({ width: 0, height: 0 });
      setCropRect({ x: 0, y: 0, width: 100, height: 100 });
      return undefined;
    }

    const { stem } = splitFileNameParts(replaceTarget?.name || '');
    setRenameValue(stem || '');
    setEditorBusy('');
    setCropRect({ x: 0, y: 0, width: 100, height: 100 });

    if (!replaceIsStaticImage || !replaceTarget?.url) {
      setEditorImageSrc('');
      setEditorImageError('');
      setEditorImageMeta({ width: 0, height: 0 });
      return undefined;
    }

    let cancelled = false;
    let objectUrl = '';
    setEditorImageSrc('');
    setEditorImageError('');
    setEditorImageMeta({ width: 0, height: 0 });

    (async () => {
      try {
        const res = await fetch(replaceTarget.url);
        if (!res.ok) throw new Error('Falha ao carregar a imagem para edição.');
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        const img = new window.Image();
        img.onload = () => {
          if (cancelled) return;
          setEditorImageSrc(objectUrl);
          setEditorImageMeta({ width: img.naturalWidth || 0, height: img.naturalHeight || 0 });
        };
        img.onerror = () => {
          if (cancelled) return;
          setEditorImageError('Não foi possível preparar a imagem para recorte.');
        };
        img.src = objectUrl;
      } catch (err) {
        if (!cancelled) {
          setEditorImageError(err?.message || 'Não foi possível preparar a imagem para recorte.');
        }
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [replaceTarget, replaceIsStaticImage]);

  useEffect(() => {
    if (!replaceIsStaticImage || !editorImageSrc || !cropPreviewCanvasRef.current) return undefined;

    let cancelled = false;
    const img = new window.Image();
    img.onload = () => {
      if (cancelled || !cropPreviewCanvasRef.current) return;
      const canvas = cropPreviewCanvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const rect = normalizeCropRect(cropRect);
      const sx = Math.round((rect.x / 100) * img.naturalWidth);
      const sy = Math.round((rect.y / 100) * img.naturalHeight);
      const sw = Math.max(1, Math.round((rect.width / 100) * img.naturalWidth));
      const sh = Math.max(1, Math.round((rect.height / 100) * img.naturalHeight));
      canvas.width = sw;
      canvas.height = sh;
      ctx.clearRect(0, 0, sw, sh);
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    };
    img.src = editorImageSrc;
    return () => {
      cancelled = true;
    };
  }, [cropRect, editorImageSrc, replaceIsStaticImage]);

  useEffect(() => {
    let cancelled = false;
    async function loadMedia() {
      if (!bookId || activeTab !== 'media') {
        if (!cancelled) setMediaItems([]);
        return;
      }
      setMediaLoading(true);
      try {
        const headers = { 'x-book-id': String(bookId) };
        const [imageData, audioData, videoData] = await Promise.all([
          storageListWithRoot('pages', { path: '', root: 'library', recursive: true, headers }),
          storageListWithRoot('audios', { path: '', root: 'library', recursive: true, headers }),
          storageListWithRoot('videos', { path: '', root: 'library', recursive: true, headers }),
        ]);
        const imageFiles = (Array.isArray(imageData) ? imageData : [])
          .filter((i) => i?.type !== 'folder')
          .map((item) => ({
            ...item,
            bucket: 'pages',
            directUrl: item?.path
              ? `${apiBaseUrl}/media/pages/${item.path
                  .split('/')
                  .map((segment) => encodeURIComponent(segment))
                  .join('/')}`
              : '',
          }));
        const audioFiles = (Array.isArray(audioData) ? audioData : [])
          .filter((i) => i?.type !== 'folder')
          .map((item) => ({
            ...item,
            type: 'audio',
            bucket: 'audios',
            directUrl: item?.path
              ? `${apiBaseUrl}/media/audios/${item.path
                  .split('/')
                  .map((segment) => encodeURIComponent(segment))
                  .join('/')}`
              : '',
          }));
        const videoFiles = (Array.isArray(videoData) ? videoData : [])
          .filter((i) => i?.type !== 'folder')
          .map((item) => ({
            ...item,
            type: 'video',
            bucket: 'videos',
            directUrl: item?.path
              ? `${apiBaseUrl}/media/videos/${item.path
                  .split('/')
                  .map((segment) => encodeURIComponent(segment))
                  .join('/')}`
              : '',
          }));
        if (!cancelled) setMediaItems([...imageFiles, ...audioFiles, ...videoFiles]);
      } finally {
        if (!cancelled) setMediaLoading(false);
      }
    }
    void loadMedia();
    return () => {
      cancelled = true;
    };
  }, [activeTab, bookId, apiBaseUrl]);

  const visibleMedia = mediaItems.filter((item) => {
    if (mediaType === 'audio') return item.type === 'audio';
    if (mediaType === 'video') return item.type === 'video';
    return item.type !== 'audio' && item.type !== 'video';
  });

  const reloadMedia = async () => {
    if (!bookId) return;
    setMediaLoading(true);
    try {
      const headers = { 'x-book-id': String(bookId) };
      const [imageData, audioData, videoData] = await Promise.all([
        storageListWithRoot('pages', { path: '', root: 'library', recursive: true, headers }),
        storageListWithRoot('audios', { path: '', root: 'library', recursive: true, headers }),
        storageListWithRoot('videos', { path: '', root: 'library', recursive: true, headers }),
      ]);
      const imageFiles = (Array.isArray(imageData) ? imageData : [])
        .filter((i) => i?.type !== 'folder')
        .map((item) => ({
          ...item,
          bucket: 'pages',
          directUrl: item?.path
            ? `${apiBaseUrl}/media/pages/${item.path
                .split('/')
                .map((segment) => encodeURIComponent(segment))
                .join('/')}`
            : '',
        }));
      const audioFiles = (Array.isArray(audioData) ? audioData : [])
        .filter((i) => i?.type !== 'folder')
        .map((item) => ({
          ...item,
          type: 'audio',
          bucket: 'audios',
          directUrl: item?.path
            ? `${apiBaseUrl}/media/audios/${item.path
                .split('/')
                .map((segment) => encodeURIComponent(segment))
                .join('/')}`
            : '',
        }));
      const videoFiles = (Array.isArray(videoData) ? videoData : [])
        .filter((i) => i?.type !== 'folder')
        .map((item) => ({
          ...item,
          type: 'video',
          bucket: 'videos',
          directUrl: item?.path
            ? `${apiBaseUrl}/media/videos/${item.path
                .split('/')
                .map((segment) => encodeURIComponent(segment))
                .join('/')}`
            : '',
        }));
      setMediaItems([...imageFiles, ...audioFiles, ...videoFiles]);
    } finally {
      setMediaLoading(false);
    }
  };

  const handleDeleteMedia = async (item) => {
    if (!bookId || !item?.bucket) return;
    const objectKey = typeof item.storageKey === 'string' && item.storageKey.trim() ? item.storageKey.trim() : '';
    const legacyPath = typeof item.path === 'string' && item.path.trim() ? item.path.trim() : '';
    if (!objectKey && !legacyPath) return;
    const confirmDelete = window.confirm(`Excluir "${item.name}"?`);
    if (!confirmDelete) return;
    const busy = libraryItemBusyKey(item);
    try {
      setProcessingPath(busy);
      await storageDeleteObjectWithRoot(item.bucket, {
        path: objectKey ? '' : legacyPath,
        objectKey: objectKey || undefined,
        root: 'library',
        headers: { 'x-book-id': String(bookId) },
      });
      await reloadMedia();
      toast.success('Ficheiro removido.');
    } catch (err) {
      toast.error(err?.message || 'Não foi possível excluir o ficheiro.');
    } finally {
      setProcessingPath('');
    }
  };

  const handleReplaceMedia = async (item, file) => {
    if (!bookId || !item?.bucket || !file) return;
    const objectKey = typeof item.storageKey === 'string' && item.storageKey.trim() ? item.storageKey.trim() : '';
    const legacyPath = typeof item.path === 'string' && item.path.trim() ? item.path.trim() : '';
    if (!objectKey && !legacyPath) return;
    const busy = libraryItemBusyKey(item);
    try {
      setProcessingPath(busy);
      await storageReplaceWithRoot(item.bucket, {
        path: objectKey ? '' : legacyPath,
        objectKey: objectKey || undefined,
        file,
        root: 'library',
        headers: { 'x-book-id': String(bookId) },
      });
      await reloadMedia();
      toast.success('Ficheiro atualizado.');
    } catch (err) {
      toast.error(err?.message || 'Não foi possível substituir o ficheiro.');
    } finally {
      setProcessingPath('');
    }
  };

  /**
   * Persiste o nome na API se tiver mudado.
   * @param {object} item
   * @param {{ requireChange?: boolean }} opts — se true, mostra erro se o nome não mudou (botão "Salvar nome").
   * @returns {Promise<boolean>} true se pode fechar o modal / operação concluída sem erro
   */
  const tryPersistRename = async (item, opts = {}) => {
    const { requireChange = false } = opts;
    if (!bookId || !item?.bucket) return false;
    const objectKey = getItemObjectKey(item);
    const legacyPath = typeof item.path === 'string' && item.path.trim() ? item.path.trim() : '';
    if (!objectKey && !legacyPath) {
      toast.error('Renomear requer um ficheiro válido.');
      return false;
    }
    const nextFileName = buildRenamedFileName(item, renameValue);
    if (!nextFileName) {
      toast.error('Informe um nome válido.');
      return false;
    }
    const currentName = String(item?.name || '').trim();
    if (nextFileName === currentName) {
      if (requireChange) {
        toast.error('O nome já está igual ao atual.');
        return false;
      }
      return true;
    }
    const busy = libraryItemBusyKey(item);
    try {
      setEditorBusy('rename');
      setProcessingPath(busy);
      await storageRenameWithRoot(item.bucket, {
        root: 'library',
        headers: { 'x-book-id': String(bookId) },
        path: objectKey ? '' : legacyPath,
        objectKey: objectKey || undefined,
        fileName: nextFileName,
      });
      await reloadMedia();
      toast.success('Nome guardado.');
      return true;
    } catch (err) {
      toast.error(err?.message || 'Não foi possível renomear o ficheiro.');
      return false;
    } finally {
      setEditorBusy('');
      setProcessingPath('');
    }
  };

  const handleRenameMedia = async (item) => {
    const ok = await tryPersistRename(item, { requireChange: true });
    if (ok) setReplaceTarget(null);
  };

  /** Guarda o nome (se alterado) e fecha o modal — botão principal no rodapé. */
  const handleSaveAndCloseModal = async () => {
    if (!replaceTarget || editorBusy === 'crop') return;
    if (replaceIsVideo) {
      setReplaceTarget(null);
      return;
    }
    const ok = await tryPersistRename(replaceTarget, { requireChange: false });
    if (ok) setReplaceTarget(null);
  };

  const handleCropImage = async (item) => {
    if (!bookId || !item?.bucket || !editorImageSrc || !replaceIsStaticImage) return;
    const objectKey = getItemObjectKey(item);
    const legacyPath = typeof item.path === 'string' && item.path.trim() ? item.path.trim() : '';
    if (!objectKey && !legacyPath) return;

    const img = new window.Image();
    const loadPromise = new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('Não foi possível carregar a imagem para recorte.'));
    });
    img.src = editorImageSrc;

    try {
      setEditorBusy('crop');
      await loadPromise;
      const rect = normalizeCropRect(cropRect);
      const sx = Math.round((rect.x / 100) * img.naturalWidth);
      const sy = Math.round((rect.y / 100) * img.naturalHeight);
      const sw = Math.max(1, Math.round((rect.width / 100) * img.naturalWidth));
      const sh = Math.max(1, Math.round((rect.height / 100) * img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas indisponível para recorte.');
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (value) => {
            if (value) resolve(value);
            else reject(new Error('Não foi possível gerar a imagem recortada.'));
          },
          mimeFromImageName(item?.name || ''),
          0.92,
        );
      });

      const file = new File([blob], item?.name || 'imagem_recortada.png', {
        type: blob.type || mimeFromImageName(item?.name || ''),
      });
      await handleReplaceMedia(item, file);
      setReplaceTarget(null);
    } catch (err) {
      toast.error(err?.message || 'Não foi possível recortar a imagem.');
    } finally {
      setEditorBusy('');
    }
  };

  const handleUploadMedia = async (event) => {
    const file = event.target.files?.[0];
    if (!bookId || !file) return;
    const bucket = mediaType === 'audio' ? 'audios' : mediaType === 'video' ? 'videos' : 'pages';
    try {
      setUploadingMedia(true);
      setUploadProgress(0);
      await storageUploadWithProgressAndRoot(bucket, {
        path: '',
        file,
        root: 'library',
        headers: { 'x-book-id': String(bookId) },
        onProgress: (pct) => setUploadProgress(Number(pct || 0)),
      });
      await reloadMedia();
      toast.success('Upload concluído.');
    } catch (err) {
      toast.error(err?.message || 'Falha no upload.');
    } finally {
      setUploadingMedia(false);
      setUploadProgress(0);
      event.target.value = '';
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-slate-700 px-3 py-2">
        {showTabs ? (
          <div className="mb-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => onTabChange?.('pages')}
              className={`rounded px-2.5 py-1 text-xs font-semibold ${
                activeTab === 'pages'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
              }`}
            >
              Paginas
            </button>
            <button
              type="button"
              onClick={() => onTabChange?.('media')}
              className={`rounded px-2.5 py-1 text-xs font-semibold ${
                activeTab === 'media'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
              }`}
            >
              Midia
            </button>
          </div>
        ) : null}

        {activeTab === 'pages' ? (
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-slate-200">Paginas</div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onAddPage}
                className="rounded bg-slate-700 p-2 text-slate-200 transition-colors hover:bg-slate-600"
                title="Adicionar pagina"
              >
                <FiPlus />
              </button>
              {pages.length > 1 ? (
                <button
                  type="button"
                  onClick={onDeletePage}
                  className="rounded bg-slate-700 p-2 text-slate-200 transition-colors hover:bg-slate-600"
                  title="Remover pagina"
                >
                  <FiTrash2 />
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-slate-200">Midia do livro</div>
              <div className="flex items-center gap-1 rounded bg-slate-900 p-1">
                <button
                  type="button"
                  onClick={() => onMediaTypeChange?.('image')}
                  className={`rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                    mediaType === 'image'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  Imagens
                </button>
                <button
                  type="button"
                  onClick={() => onMediaTypeChange?.('video')}
                  className={`rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                    mediaType === 'video'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  Videos
                </button>
                <button
                  type="button"
                  onClick={() => onMediaTypeChange?.('audio')}
                  className={`rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                    mediaType === 'audio'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  Audios
                </button>
              </div>
            </div>
            <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded bg-indigo-600 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white transition-colors hover:bg-indigo-500">
              <FiUploadCloud size={13} />
              {uploadingMedia
                ? `Enviando ${Math.max(0, Math.min(100, uploadProgress))}%`
                : mediaType === 'audio'
                  ? 'Upload de audio'
                  : mediaType === 'video'
                    ? 'Upload de video'
                    : 'Upload de imagem'}
              <input
                type="file"
                className="hidden"
                accept={getAcceptFromMediaType(mediaType)}
                onChange={handleUploadMedia}
                disabled={uploadingMedia}
              />
            </label>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {activeTab === 'pages' ? (
          <div className="space-y-3">
            {pages.map((page, index) => {
              const active = index === currentPage;
              const previewUrl = getPagePreviewUrl(page);
              const transitionType = String(page?.meta?.transition?.type || 'none');
              return (
                <div key={page.id || `page-${index}`}>
                  <button
                    type="button"
                    onClick={() => onSelectPage(index)}
                    className={`w-full rounded border p-2 text-left transition ${
                      active
                        ? 'border-indigo-400 bg-indigo-500/10'
                        : 'border-slate-700 bg-slate-900 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
                      <span>Pagina {index + 1}</span>
                      {transitionType !== 'none' ? (
                        <span className="rounded bg-indigo-600/30 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-indigo-200">
                          {transitionType}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 aspect-[16/9] w-full rounded border border-slate-700 bg-slate-900">
                      {previewUrl ? (
                        isGifUrl(previewUrl) ? (
                          <GifStillThumb url={previewUrl} />
                        ) : (
                          <img
                            src={previewUrl}
                            alt=""
                            className="h-full w-full object-cover"
                            draggable={false}
                          />
                        )
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-slate-900">
                          <FiImage size={32} className="text-slate-200/90" />
                        </div>
                      )}
                    </div>
                  </button>
                  {index < pages.length - 1 ? (
                    <div className="flex items-center justify-center py-2">
                      <button
                        type="button"
                        onClick={() => onSelectTransitionBetweenPages?.(index)}
                        className={`flex h-6 w-6 items-center justify-center rounded border bg-slate-800 transition-colors ${
                          transitionType !== 'none'
                            ? 'border-indigo-400 text-indigo-300 hover:border-indigo-300 hover:text-indigo-200'
                            : 'border-slate-600 text-slate-200 hover:border-indigo-400 hover:text-indigo-300'
                        }`}
                        title={`Transicao entre pagina ${index + 1} e ${index + 2}`}
                      >
                        {transitionType !== 'none' ? (
                          <FiCheckSquare size={12} />
                        ) : (
                          <FiPlus size={12} />
                        )}
                      </button>
                    </div>
                  ) : null}
                  </div>
              );
            })}
          </div>
        ) : mediaLoading ? (
          <div className="flex items-center justify-center py-6 text-xs text-slate-400">
            Carregando midia...
          </div>
        ) : visibleMedia.length === 0 ? (
          <div className="flex items-center justify-center py-6 text-xs text-slate-500">
            Nenhum arquivo encontrado.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {visibleMedia.map((item, index) => {
              const key = item?.id || item?.path || `asset-${index}`;
              const previewUrl = item?.url || item?.directUrl || '';
              const isAudio = item?.type === 'audio';
              const isVideo = item?.type === 'video';
              const isGif = item?.type === 'gif' || isGifUrl(item?.name || previewUrl);
              return (
                <div
                  key={key}
                  role="button"
                  tabIndex={0}
                  draggable={!isAudio}
                  onDragStart={(event) => {
                    if (isAudio) return;
                    const payload = { ...item, url: previewUrl };
                    event.dataTransfer.effectAllowed = 'copy';
                    event.dataTransfer.setData(
                      'application/x-luditeca-media',
                      JSON.stringify(payload),
                    );
                    event.dataTransfer.setData('text/plain', payload?.name || 'media');
                  }}
                  onClick={() => onSelectMedia?.({ ...item, url: previewUrl })}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onSelectMedia?.({ ...item, url: previewUrl });
                    }
                  }}
                  className="w-full rounded border border-slate-700 bg-slate-900 p-2 text-left transition hover:bg-slate-800"
                >
                  <div className="relative aspect-[16/9] w-full rounded border border-slate-700 bg-slate-900">
                    {isAudio ? (
                      <div className="flex h-full w-full items-center justify-center">
                        <FiMusic size={24} className="text-slate-400" />
                      </div>
                    ) : isVideo ? (
                      previewUrl ? (
                        <video
                          src={previewUrl}
                          className="h-full w-full object-cover"
                          muted
                          playsInline
                          preload="metadata"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <FiVideo size={24} className="text-slate-400" />
                        </div>
                      )
                    ) : previewUrl ? (
                      isGif ? (
                        <GifStillThumb url={previewUrl} />
                      ) : (
                        <img
                          src={previewUrl}
                          alt=""
                          className="h-full w-full object-cover"
                          draggable={false}
                        />
                      )
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <FiImage size={24} className="text-slate-400" />
                      </div>
                    )}
                    <div className="absolute right-1 top-1 z-10 flex items-center gap-1">
                      {!isAudio ? (
                        <button
                          type="button"
                          className="rounded bg-slate-800/90 p-1 text-slate-100 hover:bg-slate-700"
                          title={isVideo ? 'Substituir vídeo na biblioteca' : 'Substituir imagem na biblioteca'}
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            setReplaceTarget({ ...item, url: previewUrl });
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          <FiEdit2 size={12} />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="rounded bg-red-700/90 p-1 text-white hover:bg-red-600"
                        title="Excluir arquivo"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDeleteMedia(item);
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <FiTrash2 size={12} />
                      </button>
                    </div>
                    {processingPath === libraryItemBusyKey(item) ? (
                      <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/60 text-[10px] text-slate-100">
                        Processando...
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {replaceTarget && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4"
              role="presentation"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setReplaceTarget(null);
              }}
            >
              <div
                className="relative max-h-[min(92dvh,760px)] w-full max-w-2xl overflow-y-auto overflow-x-hidden rounded-xl border border-slate-600 bg-slate-800 shadow-xl"
                role="dialog"
                aria-modal="true"
                aria-labelledby="replace-media-title"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between border-b border-slate-700 px-4 py-3">
                  <div>
                    <h2 id="replace-media-title" className="text-sm font-semibold text-slate-100">
                      {replaceIsVideo ? 'Substituir vídeo' : replaceIsGif ? 'Editar GIF' : 'Editar imagem'}
                    </h2>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                      {replaceIsVideo
                        ? 'Use esta janela para trocar o ficheiro do vídeo mantendo o mesmo registo na biblioteca.'
                        : 'Ajuste o nome, use recorte em imagens estáticas ou substitua o ficheiro. Use Guardar e fechar no rodapé para gravar o nome e sair — não confundir com Salvar projeto no topo.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-white"
                    aria-label="Fechar"
                    onClick={() => setReplaceTarget(null)}
                  >
                    <FiX size={18} />
                  </button>
                </div>

                <div className="border-b border-slate-700 px-4 py-3">
                  <p className="mb-2 truncate text-[10px] font-medium uppercase tracking-wide text-slate-500">
                    Ficheiro atual
                  </p>
                  <div className="truncate text-xs text-slate-200">{replaceTarget.name || 'sem nome'}</div>
                  <div className="mt-3 aspect-video w-full max-h-[36vh] overflow-hidden rounded-lg border border-slate-700 bg-slate-950">
                    {replaceIsVideo && replaceTarget.url ? (
                      <video
                        src={replaceTarget.url}
                        className="h-full w-full object-contain"
                        controls
                        playsInline
                        preload="metadata"
                      />
                    ) : replaceTarget.url && replaceIsGif ? (
                      <GifStillThumb url={replaceTarget.url} className="object-contain" />
                    ) : replaceTarget.url ? (
                      <img src={replaceTarget.url} alt="" className="h-full w-full object-contain" draggable={false} />
                    ) : (
                      <div className="flex h-full items-center justify-center text-slate-500">
                        <FiImage size={32} />
                      </div>
                    )}
                  </div>
                </div>

                {!replaceIsVideo ? (
                  <div className="grid gap-4 border-b border-slate-700 px-4 py-3 lg:grid-cols-[minmax(0,1fr)_280px]">
                    <div className="space-y-4">
                      <section className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
                        <div className="mb-3 text-xs font-semibold text-slate-200">Nome do ficheiro</div>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <input
                            type="text"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            placeholder="novo_nome"
                            className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                          />
                          <button
                            type="button"
                            disabled={editorBusy === 'rename'}
                            className="rounded-md bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
                            onClick={() => void handleRenameMedia(replaceTarget)}
                          >
                            {editorBusy === 'rename' ? 'Renomeando...' : 'Salvar nome'}
                          </button>
                        </div>
                        <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
                          A extensão é preservada automaticamente. O nome é sanitizado para evitar caracteres inválidos.
                          <span className="mt-1 block text-slate-400">
                            Dica: o botão <span className="font-semibold text-slate-300">Guardar e fechar</span> no fim
                            da janela grava o nome (se alterou) e fecha — não precisa de usar só &quot;Salvar nome&quot;.
                          </span>
                        </p>
                      </section>

                      {replaceIsStaticImage ? (
                        <section className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
                          <div className="mb-3 text-xs font-semibold text-slate-200">Recorte simples</div>
                          {editorImageError ? (
                            <div className="rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                              {editorImageError}
                            </div>
                          ) : (
                            <>
                              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                  X %
                                  <input
                                    type="number"
                                    min="0"
                                    max="99"
                                    value={cropRect.x}
                                    onChange={(e) =>
                                      setCropRect((prev) => normalizeCropRect({ ...prev, x: e.target.value }))
                                    }
                                    className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                                  />
                                </label>
                                <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                  Y %
                                  <input
                                    type="number"
                                    min="0"
                                    max="99"
                                    value={cropRect.y}
                                    onChange={(e) =>
                                      setCropRect((prev) => normalizeCropRect({ ...prev, y: e.target.value }))
                                    }
                                    className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                                  />
                                </label>
                                <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                  Largura %
                                  <input
                                    type="number"
                                    min="1"
                                    max="100"
                                    value={cropRect.width}
                                    onChange={(e) =>
                                      setCropRect((prev) => normalizeCropRect({ ...prev, width: e.target.value }))
                                    }
                                    className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                                  />
                                </label>
                                <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                  Altura %
                                  <input
                                    type="number"
                                    min="1"
                                    max="100"
                                    value={cropRect.height}
                                    onChange={(e) =>
                                      setCropRect((prev) => normalizeCropRect({ ...prev, height: e.target.value }))
                                    }
                                    className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                                  />
                                </label>
                              </div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  className="rounded border border-slate-600 bg-slate-800 px-2.5 py-1.5 text-[10px] font-semibold text-slate-200 hover:bg-slate-700"
                                  onClick={() => setCropRect({ x: 0, y: 0, width: 100, height: 100 })}
                                >
                                  Original
                                </button>
                                <button
                                  type="button"
                                  className="rounded border border-slate-600 bg-slate-800 px-2.5 py-1.5 text-[10px] font-semibold text-slate-200 hover:bg-slate-700"
                                  onClick={() => setCropRect({ x: 12.5, y: 0, width: 75, height: 100 })}
                                >
                                  Retrato
                                </button>
                                <button
                                  type="button"
                                  className="rounded border border-slate-600 bg-slate-800 px-2.5 py-1.5 text-[10px] font-semibold text-slate-200 hover:bg-slate-700"
                                  onClick={() => setCropRect({ x: 0, y: 12.5, width: 100, height: 75 })}
                                >
                                  Paisagem
                                </button>
                                <button
                                  type="button"
                                  className="rounded border border-slate-600 bg-slate-800 px-2.5 py-1.5 text-[10px] font-semibold text-slate-200 hover:bg-slate-700"
                                  onClick={() => setCropRect({ x: 12.5, y: 12.5, width: 75, height: 75 })}
                                >
                                  Quadrado
                                </button>
                              </div>
                              <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
                                Dimensão original: {editorImageMeta.width || 0} x {editorImageMeta.height || 0}px.
                                O recorte é aplicado sobrescrevendo a imagem actual na biblioteca.
                              </p>
                            </>
                          )}
                        </section>
                      ) : (
                        <section className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
                          <div className="text-xs font-semibold text-slate-200">Recorte</div>
                          <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
                            O recorte automático está disponível para imagens estáticas. GIFs animados mantêm apenas as
                            opções de nome e substituição para evitar perder a animação.
                          </p>
                        </section>
                      )}
                    </div>

                    <section className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
                      <div className="mb-3 text-xs font-semibold text-slate-200">Prévia do recorte</div>
                      {replaceIsStaticImage && !editorImageError ? (
                        <>
                          <div className="overflow-hidden rounded-lg border border-slate-700 bg-slate-950">
                            <canvas ref={cropPreviewCanvasRef} className="h-auto w-full" />
                          </div>
                          <button
                            type="button"
                            disabled={editorBusy === 'crop'}
                            className="mt-3 w-full rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                            onClick={() => void handleCropImage(replaceTarget)}
                          >
                            {editorBusy === 'crop' ? 'Aplicando recorte...' : 'Aplicar recorte'}
                          </button>
                        </>
                      ) : (
                        <div className="rounded border border-slate-700 bg-slate-950 px-3 py-8 text-center text-xs text-slate-500">
                          Prévia indisponível para este ficheiro.
                        </div>
                      )}
                    </section>
                  </div>
                ) : null}

                <div className="flex flex-col gap-2 border-t border-slate-700/80 bg-slate-900/40 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                  <p className="order-last w-full text-[10px] leading-relaxed text-slate-500 sm:order-first sm:mb-0 sm:max-w-[55%] sm:w-auto">
                    {replaceIsVideo
                      ? 'Fechar apenas sai desta janela; o vídeo só muda ao substituir o ficheiro.'
                      : 'Guardar e fechar grava o nome na biblioteca (se estiver diferente). Recorte usa Aplicar recorte à direita.'}
                  </p>
                  <div className="flex w-full flex-col gap-2 sm:order-last sm:w-auto sm:flex-row sm:justify-end">
                    {!replaceIsVideo ? (
                      <button
                        type="button"
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() => void handleSaveAndCloseModal()}
                        disabled={editorBusy === 'crop' || editorBusy === 'rename'}
                      >
                        <FiSave size={14} aria-hidden />
                        Guardar e fechar
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700"
                      onClick={() => setReplaceTarget(null)}
                      disabled={editorBusy === 'crop' || editorBusy === 'rename'}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500"
                      onClick={() => replaceFileInputRef.current?.click()}
                      disabled={editorBusy === 'rename'}
                    >
                      {replaceIsVideo ? 'Escolher novo vídeo…' : 'Substituir ficheiro…'}
                    </button>
                  </div>
                </div>

                <input
                  ref={replaceFileInputRef}
                  type="file"
                  className="sr-only"
                  tabIndex={-1}
                  accept={
                    replaceIsVideo
                      ? 'video/*,.mp4,.webm,.mov,.m4v'
                      : 'image/*,image/gif,.gif,.webp,.png,.jpg,.jpeg'
                  }
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    const target = replaceTarget;
                    e.target.value = '';
                    setReplaceTarget(null);
                    if (file && target) void handleReplaceMedia(target, file);
                  }}
                />
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

