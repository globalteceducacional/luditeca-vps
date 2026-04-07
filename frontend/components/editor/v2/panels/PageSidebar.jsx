import React, { useCallback, useEffect, useRef, useState } from 'react';
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
} from 'react-icons/fi';
import {
  storageDeleteObjectWithRoot,
  storageListWithRoot,
  storageRenameWithRoot,
  storageReplaceWithRoot,
  storageUploadWithProgressAndRoot,
} from '../../../../lib/storageApi';
import { getApiBaseUrl } from '../../../../lib/apiClient';
import StorageBackedHtmlImage from '../../StorageBackedHtmlImage';
import MediaLibraryThumb from '../media/MediaLibraryThumb';
import ImageEditorPanel from '../media/ImageEditorPanel';
import MediaEditModal from '../media/MediaEditModal';
import VideoEditorPanel from '../media/VideoEditorPanel';
import {
  buildRenamedFileName,
  clampNum,
  getAcceptFromMediaType,
  getLibraryMediaFormatBadge,
  getItemObjectKey,
  hasImageAdjustmentsChanged,
  imageCssFilter,
  initialRenameStem,
  libraryItemBusyKey,
  mimeFromImageName,
  normalizeCropRect,
  normalizeImageAdjustments,
  readMediaMetaMap,
  writeMediaMetaMap,
} from '../media/mediaLibraryUtils';
import useMediaLibraryData from '../hooks/useMediaLibraryData';

/** URL + storage do fundo ou da primeira imagem (para GIF animado e URLs presign renováveis). */
function getPagePreviewMedia(page) {
  const bgRaw = page?.background;
  if (bgRaw) {
    if (typeof bgRaw === 'string') return { url: bgRaw, storage: undefined };
    return {
      url: typeof bgRaw.url === 'string' ? bgRaw.url : '',
      storage: typeof bgRaw === 'object' && bgRaw?.storage ? bgRaw.storage : undefined,
    };
  }
  const nodes = Array.isArray(page?.nodes) ? page.nodes : [];
  const imageNodes = nodes
    .filter((n) => n?.type === 'image' && typeof n?.props?.content === 'string' && n.props.content.trim())
    .sort((a, b) => Number(a?.zIndex || 0) - Number(b?.zIndex || 0));
  const first = imageNodes[0];
  if (!first?.props?.content) return { url: '', storage: undefined };
  return {
    url: first.props.content,
    storage: first.props?.storage,
  };
}

function storageFromLibraryItem(item) {
  const filePath =
    (typeof item?.storageKey === 'string' && item.storageKey.trim()) ||
    (typeof item?.path === 'string' && item.path.trim()) ||
    '';
  if (!filePath) return undefined;
  return {
    bucket: (typeof item?.bucket === 'string' && item.bucket.trim()) || 'pages',
    filePath,
  };
}

/** Cores discretas por formato — marcador à esquerda da miniatura na biblioteca. */
const LIBRARY_FORMAT_BADGE_CLASS = {
  video: 'bg-fuchsia-700/95 text-fuchsia-50 ring-1 ring-fuchsia-500/40',
  audio: 'bg-violet-700/95 text-violet-50 ring-1 ring-violet-500/40',
  jpg: 'bg-indigo-800/95 text-indigo-100 ring-1 ring-indigo-500/35',
  png: 'bg-sky-800/95 text-sky-50 ring-1 ring-sky-500/35',
  webp: 'bg-teal-800/95 text-teal-50 ring-1 ring-teal-500/35',
  svg: 'bg-orange-800/95 text-orange-50 ring-1 ring-orange-500/35',
  avif: 'bg-emerald-800/95 text-emerald-50 ring-1 ring-emerald-500/35',
  bmp: 'bg-slate-700/95 text-slate-100 ring-1 ring-slate-500/40',
  other: 'bg-slate-800/95 text-slate-100 ring-1 ring-slate-600/50',
  generic: 'bg-slate-800/95 text-slate-200 ring-1 ring-slate-600/50',
};

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
  const [processingPath, setProcessingPath] = useState('');
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [mediaMetaMap, setMediaMetaMap] = useState({});
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
  const [imageAdjustments, setImageAdjustments] = useState(normalizeImageAdjustments({}));
  const [videoEditorSettings, setVideoEditorSettings] = useState({
    startAt: 0,
    endAt: 0,
    playbackRate: 1,
    volume: 1,
    loop: false,
    muted: true,
  });
  const apiBaseUrl = getApiBaseUrl();
  const loadLibraryItems = useCallback(async () => {
    if (!bookId) return [];
    const headers = { 'x-book-id': String(bookId) };
    const [imageData, audioData, videoData] = await Promise.all([
      storageListWithRoot('pages', { path: '', root: 'library', recursive: true, headers }),
      storageListWithRoot('audios', { path: '', root: 'library', recursive: true, headers }),
      storageListWithRoot('videos', { path: '', root: 'library', recursive: true, headers }),
    ]);
    return buildLibraryItems(imageData, audioData, videoData);
  }, [bookId, apiBaseUrl]);
  const {
    mediaItems,
    setMediaItems,
    mediaLoading,
    setMediaLoading,
    reloadMedia,
  } = useMediaLibraryData({
    activeTab,
    bookId,
    loadItems: loadLibraryItems,
  });

  const replaceIsVideo = replaceTarget?.type === 'video';
  const replaceIsStaticImage =
    Boolean(replaceTarget) && !replaceIsVideo && replaceTarget?.type !== 'audio';

  useEffect(() => {
    setMediaMetaMap(readMediaMetaMap(bookId));
  }, [bookId]);

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
      setImageAdjustments(normalizeImageAdjustments({}));
      setVideoEditorSettings({
        startAt: 0,
        endAt: 0,
        playbackRate: 1,
        volume: 1,
        loop: false,
        muted: true,
      });
      return undefined;
    }

    setRenameValue(initialRenameStem(replaceTarget?.name || '') || '');
    setEditorBusy('');
    setCropRect({ x: 0, y: 0, width: 100, height: 100 });
    setImageAdjustments(normalizeImageAdjustments(replaceTarget?.editorMeta?.image || {}));
    const fromMeta = replaceTarget?.editorMeta?.video || {};
    setVideoEditorSettings({
      startAt: clampNum(fromMeta?.startAt, 0, 21600, 0),
      endAt: clampNum(fromMeta?.endAt, 0, 21600, 0),
      playbackRate: clampNum(fromMeta?.playbackRate, 0.25, 2, 1),
      volume: clampNum(fromMeta?.volume, 0, 1, 1),
      loop: Boolean(fromMeta?.loop),
      muted: fromMeta?.muted !== undefined ? Boolean(fromMeta.muted) : true,
    });

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

  const mediaMetaKeyForItem = (item) => {
    const storageKey = getItemObjectKey(item);
    if (storageKey) return `${String(item?.bucket || '')}:${storageKey}`;
    const relPath = String(item?.path || '').trim();
    if (!relPath) return '';
    return `${String(item?.bucket || '')}:${relPath}`;
  };

  const attachEditorMetaToItem = (item) => {
    const metaKey = mediaMetaKeyForItem(item);
    const editorMeta = metaKey ? mediaMetaMap?.[metaKey] || null : null;
    return { ...item, editorMeta };
  };

  const buildLibraryItems = (imageData, audioData, videoData) => {
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
    return [...imageFiles, ...audioFiles, ...videoFiles];
  };

  useEffect(() => {
    setMediaItems((prev) =>
      (Array.isArray(prev) ? prev : []).map((it) => attachEditorMetaToItem(it)),
    );
  }, [mediaMetaMap, mediaItems.length]);

  const visibleMedia = mediaItems.filter((item) => {
    if (mediaType === 'audio') return item.type === 'audio';
    if (mediaType === 'video') return item.type === 'video';
    return item.type !== 'audio' && item.type !== 'video';
  });

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

  const persistEditorMetaForItem = (item, updater) => {
    const metaKey = mediaMetaKeyForItem(item);
    if (!metaKey) return null;
    const current = mediaMetaMap?.[metaKey] && typeof mediaMetaMap[metaKey] === 'object'
      ? mediaMetaMap[metaKey]
      : {};
    const next = typeof updater === 'function' ? updater(current) : updater;
    const merged = next && typeof next === 'object' ? next : {};
    const nextMap = { ...(mediaMetaMap || {}), [metaKey]: merged };
    setMediaMetaMap(nextMap);
    writeMediaMetaMap(bookId, nextMap);
    setMediaItems((prev) =>
      (Array.isArray(prev) ? prev : []).map((it) =>
        mediaMetaKeyForItem(it) === metaKey ? { ...it, editorMeta: merged } : it,
      ),
    );
    setReplaceTarget((prev) => {
      if (!prev || mediaMetaKeyForItem(prev) !== metaKey) return prev;
      return { ...prev, editorMeta: merged };
    });
    return merged;
  };

  const persistVideoEditorMeta = (item, closeAfter = false) => {
    if (!item) return;
    const normalized = {
      startAt: clampNum(videoEditorSettings?.startAt, 0, 21600, 0),
      endAt: clampNum(videoEditorSettings?.endAt, 0, 21600, 0),
      playbackRate: clampNum(videoEditorSettings?.playbackRate, 0.25, 2, 1),
      volume: clampNum(videoEditorSettings?.volume, 0, 1, 1),
      muted: Boolean(videoEditorSettings?.muted),
      loop: Boolean(videoEditorSettings?.loop),
    };
    if (normalized.endAt > 0 && normalized.endAt <= normalized.startAt) {
      toast.error('Fim do vídeo deve ser maior que início.');
      return;
    }
    persistEditorMetaForItem(item, (current) => ({ ...current, video: normalized }));
    toast.success('Configurações de vídeo guardadas.');
    if (closeAfter) setReplaceTarget(null);
  };

  const applyImageAdjustmentsToFile = async (item) => {
    if (!bookId || !item?.bucket || !editorImageSrc || !replaceIsStaticImage) return;
    const objectKey = getItemObjectKey(item);
    const legacyPath = typeof item.path === 'string' && item.path.trim() ? item.path.trim() : '';
    if (!objectKey && !legacyPath) return;
    const normalized = normalizeImageAdjustments(imageAdjustments);

    const img = new window.Image();
    const loadPromise = new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('Não foi possível carregar a imagem para ajustes.'));
    });
    img.src = editorImageSrc;

    try {
      setEditorBusy('adjust');
      await loadPromise;
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const rad = (normalized.rotation * Math.PI) / 180;
      const cos = Math.abs(Math.cos(rad));
      const sin = Math.abs(Math.sin(rad));
      const canvas = document.createElement('canvas');
      const outW = Math.max(1, Math.round(w * cos + h * sin));
      const outH = Math.max(1, Math.round(w * sin + h * cos));
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas indisponível para ajustes.');
      ctx.save();
      ctx.translate(outW / 2, outH / 2);
      ctx.rotate(rad);
      ctx.filter = imageCssFilter(normalized);
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
      ctx.restore();

      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (value) => (value ? resolve(value) : reject(new Error('Falha ao exportar ajustes da imagem.'))),
          mimeFromImageName(item?.name || ''),
          0.92,
        );
      });
      const file = new File([blob], item?.name || 'imagem_ajustada.png', {
        type: blob.type || mimeFromImageName(item?.name || ''),
      });
      await handleReplaceMedia(item, file);
      persistEditorMetaForItem(item, (current) => ({ ...current, image: normalized }));
      toast.success('Ajustes de imagem aplicados.');
      setReplaceTarget(null);
    } catch (err) {
      toast.error(err?.message || 'Não foi possível aplicar os ajustes da imagem.');
    } finally {
      setEditorBusy('');
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

  /** Guarda o nome (se alterado) e fecha o modal — imagem e vídeo na biblioteca. */
  const handleSaveAndCloseModal = async () => {
    if (!replaceTarget || editorBusy === 'crop' || editorBusy === 'adjust') return;
    const ok = await tryPersistRename(replaceTarget, { requireChange: false });
    if (!ok) return;
    if (replaceIsVideo) {
      persistVideoEditorMeta(replaceTarget, true);
      return;
    }
    if (replaceIsStaticImage && hasImageAdjustmentsChanged(imageAdjustments)) {
      persistEditorMetaForItem(replaceTarget, (current) => ({
        ...current,
        image: normalizeImageAdjustments(imageAdjustments),
      }));
    }
    setReplaceTarget(null);
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
              const { url: previewUrl, storage: previewStorage } = getPagePreviewMedia(page);
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
                        <StorageBackedHtmlImage
                          src={previewUrl}
                          storage={previewStorage}
                          alt=""
                          className="h-full w-full object-cover"
                          draggable={false}
                        />
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
              const formatBadge = getLibraryMediaFormatBadge(item, {
                isAudio,
                isVideo,
                previewUrl,
              });
              const badgeClass =
                LIBRARY_FORMAT_BADGE_CLASS[formatBadge.variant] || LIBRARY_FORMAT_BADGE_CLASS.generic;
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
                    <span
                      className={`pointer-events-none absolute left-1 top-1 z-10 rounded px-1 py-0.5 text-[9px] font-bold uppercase leading-none tracking-wide shadow-md ${badgeClass}`}
                      title={item?.name ? `${item.name}` : formatBadge.label}
                    >
                      {formatBadge.label}
                    </span>
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
                      <MediaLibraryThumb
                        item={item}
                        previewUrl={previewUrl}
                        storage={storageFromLibraryItem(item)}
                        className="h-full w-full object-cover"
                        draggable={false}
                      />
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
              <MediaEditModal
                title={replaceIsVideo ? 'Editar vídeo' : 'Editar imagem'}
                mediaTypeLabel={replaceIsVideo ? 'Vídeo' : 'Imagem'}
                isVideo={replaceIsVideo}
                currentName={replaceTarget.name}
                previewNode={
                  replaceIsVideo && replaceTarget.url ? (
                    <video
                      src={replaceTarget.url}
                      className="h-full w-full object-contain"
                      controls
                      playsInline
                      preload="metadata"
                    />
                  ) : replaceTarget.url ? (
                    <StorageBackedHtmlImage
                      src={replaceTarget.url}
                      storage={storageFromLibraryItem(replaceTarget)}
                      alt=""
                      className="h-full w-full object-contain"
                      draggable={false}
                      style={
                        replaceIsStaticImage
                          ? {
                              filter: imageCssFilter(imageAdjustments),
                              transform: `rotate(${normalizeImageAdjustments(imageAdjustments).rotation}deg)`,
                              transformOrigin: 'center center',
                            }
                          : undefined
                      }
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-slate-500">
                      <FiImage size={32} />
                    </div>
                  )
                }
                renameValue={renameValue}
                onRenameChange={setRenameValue}
                onRename={() => void handleRenameMedia(replaceTarget)}
                renameBusy={editorBusy === 'rename'}
                onSaveAndClose={() => void handleSaveAndCloseModal()}
                onCancel={() => setReplaceTarget(null)}
                onChooseReplacement={() => replaceFileInputRef.current?.click()}
                saveDisabled={editorBusy === 'crop' || editorBusy === 'rename' || editorBusy === 'adjust'}
                cancelDisabled={editorBusy === 'crop' || editorBusy === 'rename' || editorBusy === 'adjust'}
                replaceDisabled={editorBusy === 'rename'}
                replaceLabel={replaceIsVideo ? 'Escolher novo vídeo…' : 'Substituir ficheiro…'}
                fileInputRef={replaceFileInputRef}
                fileAccept={
                  replaceIsVideo
                    ? 'video/*,.mp4,.webm,.mov,.m4v'
                    : 'image/*,image/gif,.gif,.webp,.png,.jpg,.jpeg'
                }
                onFileChange={(e) => {
                  const file = e.target.files?.[0];
                  const target = replaceTarget;
                  e.target.value = '';
                  setReplaceTarget(null);
                  if (file && target) void handleReplaceMedia(target, file);
                }}
              >
                {replaceIsVideo ? (
                  <VideoEditorPanel
                    videoEditorSettings={videoEditorSettings}
                    setVideoEditorSettings={setVideoEditorSettings}
                    clampNum={clampNum}
                    onSaveVideoMeta={() => persistVideoEditorMeta(replaceTarget, false)}
                  />
                ) : (
                  <ImageEditorPanel
                    editorImageError={editorImageError}
                    cropRect={cropRect}
                    setCropRect={setCropRect}
                    normalizeCropRect={normalizeCropRect}
                    imageAdjustments={imageAdjustments}
                    normalizeImageAdjustments={normalizeImageAdjustments}
                    setImageAdjustments={setImageAdjustments}
                    editorBusy={editorBusy}
                    onApplyAdjustments={() => void applyImageAdjustmentsToFile(replaceTarget)}
                    editorImageMeta={editorImageMeta}
                    cropPreviewCanvasRef={cropPreviewCanvasRef}
                    onApplyCrop={() => void handleCropImage(replaceTarget)}
                  />
                )}
              </MediaEditModal>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

