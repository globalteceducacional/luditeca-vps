import React, { useEffect, useState } from 'react';
import { FiCheckSquare, FiEdit2, FiImage, FiMusic, FiPlus, FiTrash2 } from 'react-icons/fi';
import {
  storageDeleteObjectWithRoot,
  storageListWithRoot,
  storageReplaceWithRoot,
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
}) {
  const [mediaItems, setMediaItems] = useState([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [processingPath, setProcessingPath] = useState('');
  const apiBaseUrl = getApiBaseUrl();

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
        const [imageData, audioData] = await Promise.all([
          storageListWithRoot('pages', { path: '', root: 'library', recursive: true, headers }),
          storageListWithRoot('audios', { path: '', root: 'library', recursive: true, headers }),
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
        if (!cancelled) setMediaItems([...imageFiles, ...audioFiles]);
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
    return item.type !== 'audio';
  });

  const reloadMedia = async () => {
    if (!bookId) return;
    setMediaLoading(true);
    try {
      const headers = { 'x-book-id': String(bookId) };
      const [imageData, audioData] = await Promise.all([
        storageListWithRoot('pages', { path: '', root: 'library', recursive: true, headers }),
        storageListWithRoot('audios', { path: '', root: 'library', recursive: true, headers }),
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
      setMediaItems([...imageFiles, ...audioFiles]);
    } finally {
      setMediaLoading(false);
    }
  };

  const handleDeleteMedia = async (item) => {
    if (!bookId || !item?.path || !item?.bucket) return;
    const confirmDelete = window.confirm(`Excluir "${item.name}"?`);
    if (!confirmDelete) return;
    try {
      setProcessingPath(item.path);
      await storageDeleteObjectWithRoot(item.bucket, {
        path: item.path,
        root: 'library',
        headers: { 'x-book-id': String(bookId) },
      });
      await reloadMedia();
    } finally {
      setProcessingPath('');
    }
  };

  const handleReplaceMedia = async (item, file) => {
    if (!bookId || !item?.path || !item?.bucket || !file) return;
    try {
      setProcessingPath(item.path);
      await storageReplaceWithRoot(item.bucket, {
        path: item.path,
        file,
        root: 'library',
        headers: { 'x-book-id': String(bookId) },
      });
      await reloadMedia();
    } finally {
      setProcessingPath('');
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-slate-700 px-3 py-2">
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
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-slate-200">Midia do livro</div>
            <button
              type="button"
              onClick={() => onMediaTypeChange?.(mediaType === 'audio' ? 'image' : 'audio')}
              className="rounded bg-slate-700 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-200 transition-colors hover:bg-slate-600"
            >
              {mediaType === 'audio' ? 'Audios' : 'Imagens'}
            </button>
          </div>
        )}
      </div>

      <div className="min-h-0 overflow-y-auto p-3">
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
          <div className="space-y-3">
            {visibleMedia.map((item, index) => {
              const key = item?.id || item?.path || `asset-${index}`;
              const previewUrl = item?.url || item?.directUrl || '';
              const isAudio = item?.type === 'audio';
              const isGif = item?.type === 'gif' || isGifUrl(item?.name || previewUrl);
              return (
                <button
                  key={key}
                  type="button"
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
                  className="w-full rounded border border-slate-700 bg-slate-900 p-2 text-left transition hover:bg-slate-800"
                >
                  <div className="relative aspect-[16/9] w-full rounded border border-slate-700 bg-slate-900">
                    {isAudio ? (
                      <div className="flex h-full w-full items-center justify-center">
                        <FiMusic size={24} className="text-slate-400" />
                      </div>
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
                        <label
                          className="rounded bg-slate-800/90 p-1 text-slate-100 hover:bg-slate-700"
                          title="Editar imagem"
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          <FiEdit2 size={12} />
                          <input
                            type="file"
                            accept="image/*,.gif,.webp,.png,.jpg,.jpeg"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              void handleReplaceMedia(item, file);
                              e.target.value = '';
                            }}
                          />
                        </label>
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
                    {processingPath === item.path ? (
                      <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/60 text-[10px] text-slate-100">
                        Processando...
                      </div>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

