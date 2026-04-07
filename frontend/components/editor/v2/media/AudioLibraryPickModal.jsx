import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiMusic, FiX } from 'react-icons/fi';
import { toast } from 'react-hot-toast';

import { getApiBaseUrl } from '../../../../lib/apiClient';
import { storageListWithRoot } from '../../../../lib/storageApi';
import { useResolvedStorageUrl } from '../../../../lib/useResolvedStorageUrl';

function storageFromAudioItem(item) {
  const fp =
    (typeof item?.storageKey === 'string' && item.storageKey.trim()) ||
    (typeof item?.path === 'string' && item.path.trim()) ||
    '';
  if (!fp) return undefined;
  return { bucket: 'audios', filePath: fp };
}

/** Uma linha com pré-escuta e botão para vincular (hooks por item). */
function AudioPickRow({ item, onUse, applyEnabled }) {
  const previewUrl = String(item?.url || item?.directUrl || '');
  const storage = useMemo(() => storageFromAudioItem(item), [item?.path, item?.storageKey]);
  const resolvedSrc = useResolvedStorageUrl(previewUrl, storage);
  const name = String(item?.name || item?.path || 'Áudio').trim() || 'Áudio';

  const handleUse = useCallback(() => {
    if (!applyEnabled) {
      toast.error('Selecione um elemento no canvas (texto, imagem ou vídeo).');
      return;
    }
    onUse({ ...item, url: previewUrl });
  }, [applyEnabled, item, onUse, previewUrl]);

  return (
    <div className="rounded-lg border border-slate-600 bg-slate-900/90 p-3 shadow-inner">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-slate-100" title={name}>
            {name}
          </p>
          <p className="mt-0.5 text-[10px] text-slate-500">Ouça antes de vincular ao elemento.</p>
        </div>
        <span className="shrink-0 rounded bg-violet-700/90 px-1.5 py-0.5 text-[9px] font-bold uppercase text-violet-50">
          Áudio
        </span>
      </div>
      {resolvedSrc ? (
        <audio key={resolvedSrc} controls preload="metadata" className="mb-3 h-9 w-full">
          <source src={resolvedSrc} />
        </audio>
      ) : (
        <p className="mb-3 text-[10px] text-amber-200/90">A obter URL para pré-escuta…</p>
      )}
      <button
        type="button"
        onClick={handleUse}
        disabled={!resolvedSrc}
        className="w-full rounded-md bg-amber-500 px-3 py-2 text-xs font-bold text-amber-950 shadow-sm transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Usar este áudio
      </button>
    </div>
  );
}

/**
 * Modal: lista áudios da biblioteca do livro com pré-escuta antes de vincular ao nó selecionado.
 */
export default function AudioLibraryPickModal({
  isOpen,
  onClose,
  bookId,
  onPick,
  applyEnabled = true,
  onOpenMediaTab,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !bookId) return undefined;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const headers = { 'x-book-id': String(bookId) };
        const audioData = await storageListWithRoot('audios', {
          path: '',
          root: 'library',
          recursive: true,
          headers,
        });
        const apiBaseUrl = getApiBaseUrl();
        const audioFiles = (Array.isArray(audioData) ? audioData : [])
          .filter((i) => i?.type !== 'folder')
          .map((row) => ({
            ...row,
            type: 'audio',
            bucket: 'audios',
            directUrl: row?.path
              ? `${apiBaseUrl}/media/audios/${row.path
                  .split('/')
                  .map((segment) => encodeURIComponent(segment))
                  .join('/')}`
              : '',
          }));
        if (!cancelled) setItems(audioFiles);
      } catch {
        if (!cancelled) {
          setItems([]);
          toast.error('Não foi possível carregar os áudios.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, bookId]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const handlePick = useCallback(
    (file) => {
      onPick?.(file);
    },
    [onPick],
  );

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[240] flex items-center justify-center bg-black/75 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="audio-pick-modal-title"
        className="flex max-h-[min(90vh,560px)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-amber-500/35 bg-slate-950 shadow-2xl shadow-black/50"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-700 bg-slate-900/95 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 ring-1 ring-amber-400/30">
              <FiMusic className="text-amber-300" size={20} aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 id="audio-pick-modal-title" className="text-sm font-bold text-slate-100">
                Escolher áudio na biblioteca
              </h2>
              <p className="text-[11px] text-slate-400">Reproduza cada ficheiro e confirme para vincular.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onClose?.()}
            className="shrink-0 rounded-lg border border-slate-600 bg-slate-800 p-2 text-slate-300 hover:bg-slate-700"
            title="Fechar"
          >
            <FiX size={18} aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {!applyEnabled ? (
            <p className="mb-3 rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
              Selecione um elemento no canvas (texto, imagem ou vídeo) para vincular o áudio.
            </p>
          ) : null}

          {loading ? (
            <div className="flex justify-center py-10 text-sm text-slate-400">A carregar áudios…</div>
          ) : items.length === 0 ? (
            <div className="space-y-3 py-6 text-center text-sm text-slate-400">
              <p>Nenhum áudio na biblioteca deste livro.</p>
              {onOpenMediaTab ? (
                <button
                  type="button"
                  onClick={() => onOpenMediaTab()}
                  className="text-xs font-semibold text-amber-400 underline decoration-amber-500/50 hover:text-amber-300"
                >
                  Abrir Mídia → Áudios para enviar ficheiros
                </button>
              ) : null}
            </div>
          ) : (
            <ul className="space-y-3">
              {items.map((item, index) => {
                const key = item?.id || item?.path || `audio-${index}`;
                return (
                  <li key={key}>
                    <AudioPickRow item={item} onUse={handlePick} applyEnabled={applyEnabled} />
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="shrink-0 border-t border-slate-700 bg-slate-900/90 px-4 py-2.5">
          <button
            type="button"
            onClick={() => onClose?.()}
            className="w-full rounded-md border border-slate-600 bg-slate-800 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
