import React, { useEffect, useMemo, useState } from 'react';
import {
  FiImage,
  FiMusic,
  FiRefreshCw,
  FiSearch,
  FiUploadCloud,
} from 'react-icons/fi';
import {
  storageListWithRoot,
  storageUploadWithProgressAndRoot,
} from '../../../lib/storageApi';

function getBucketFromType(type) {
  if (type === 'audio') return 'audios';
  return 'pages';
}

function getAcceptFromType(type) {
  if (type === 'audio') return 'audio/*';
  return 'image/*,.gif,.webp,.png,.jpg,.jpeg';
}

export default function AssetManagerPanel({
  assetsType = 'image',
  bookId,
  onSelectAsset,
}) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const bucket = useMemo(() => getBucketFromType(assetsType), [assetsType]);
  const headers = useMemo(
    () => (bookId ? { 'x-book-id': String(bookId) } : {}),
    [bookId],
  );

  const loadAssets = async () => {
    setLoading(true);
    try {
      const data = await storageListWithRoot(bucket, {
        path: '',
        root: 'library',
        recursive: true,
        headers,
      });
      const files = (Array.isArray(data) ? data : []).filter((i) => i?.type !== 'folder');
      setItems(files);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!bookId) {
      setItems([]);
      setLoading(false);
      return;
    }
    void loadAssets();
  }, [bucket, bookId]);

  const visible = items.filter((item) => {
    if (!query.trim()) return true;
    return String(item?.name || '')
      .toLowerCase()
      .includes(query.trim().toLowerCase());
  });

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !bookId) return;
    setUploading(true);
    setProgress(0);
    try {
      await storageUploadWithProgressAndRoot(bucket, {
        path: '',
        file,
        root: 'library',
        headers,
        onProgress: (pct) => setProgress(pct),
      });
      await loadAssets();
    } finally {
      setUploading(false);
      setProgress(0);
      event.target.value = '';
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-900 text-slate-200">
      <div className="border-b border-slate-800 bg-slate-900 p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar na midia..."
              className="w-full rounded-md border border-slate-700 bg-slate-900 py-1.5 pl-9 pr-3 text-xs text-slate-200 transition-colors focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={loadAssets}
            className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
            title="Atualizar"
          >
            <FiRefreshCw size={14} />
          </button>
          <label className="flex cursor-pointer items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-indigo-500">
            <FiUploadCloud size={14} />
            Fazer Upload
            <input
              type="file"
              className="hidden"
              accept={getAcceptFromType(assetsType)}
              onChange={handleUpload}
              disabled={uploading}
            />
          </label>
        </div>
        {uploading ? (
          <div className="mt-3">
            <div className="h-1 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full bg-indigo-500 transition-all duration-300"
                style={{ width: `${Math.max(2, progress)}%` }}
              />
            </div>
            <div className="mt-1 text-right text-[10px] text-slate-400">
              Enviando... {progress}%
            </div>
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-slate-900 p-4">
        {!bookId ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-slate-500">
            <FiImage size={32} className="opacity-20" />
            <span className="text-xs">
              A midia fica na pasta do livro. Guarde o projeto e abra-o pelo editor (URL com ID do livro) para
              listar imagens e audios deste projeto.
            </span>
          </div>
        ) : loading ? (
          <div className="flex h-full items-center justify-center text-xs text-slate-500">
            Buscando midia do livro...
          </div>
        ) : visible.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-slate-500">
            <FiImage size={32} className="mb-2 opacity-20" />
            <span className="text-xs">Nenhuma midia encontrada.</span>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
            {visible.map((item) => {
              const isAudio = item?.type === 'audio' || assetsType === 'audio';
              const isGif = item?.type === 'gif' || /\.gif(?:$|[?#])/i.test(String(item?.name || ''));
              return (
                <button
                  key={item?.id || item?.path}
                  type="button"
                  onClick={() => onSelectAsset?.(item)}
                  className="group flex flex-col overflow-hidden rounded-md border border-slate-700 bg-slate-800 shadow-sm transition-all hover:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                >
                  <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden bg-slate-900">
                    {isAudio ? (
                      <FiMusic
                        size={24}
                        className="text-slate-600 transition-colors group-hover:text-indigo-400"
                      />
                    ) : isGif ? (
                      <FiImage size={24} className="text-slate-600" />
                    ) : item?.url ? (
                      <img
                        src={item.url}
                        alt={item?.name || 'asset'}
                        className="h-full w-full object-cover opacity-90 transition-all duration-300 group-hover:scale-105 group-hover:opacity-100"
                      />
                    ) : (
                      <FiImage size={24} className="text-slate-600" />
                    )}
                  </div>
                  <div className="w-full truncate border-t border-slate-700 px-2 py-1.5 text-left text-[10px] font-medium text-slate-300 transition-colors group-hover:bg-slate-700">
                    {item?.name || 'arquivo_sem_nome'}
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

