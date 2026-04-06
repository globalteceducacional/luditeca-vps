import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  FiImage,
  FiAlignCenter,
  FiAlignLeft,
  FiAlignRight,
  FiBold,
  FiItalic,
  FiUnderline,
  FiLayers,
  FiMaximize,
  FiSettings,
  FiPlay,
  FiTrash2,
  FiType,
  FiVideo,
  FiMusic,
} from 'react-icons/fi';

import 'animate.css';

import { useResolvedStorageUrl } from '../../../../lib/useResolvedStorageUrl';
import { clamp, toNum } from '../../../../lib/editorUtils';
import { EDITOR_FONT_OPTIONS, MAX_TIMELINE_STEP } from '../../editorConstants';

function linkedAudioDisplayName(audioUrl, audioStorage) {
  const path = typeof audioStorage?.filePath === 'string' ? audioStorage.filePath.trim() : '';
  if (path) {
    const parts = path.split('/').filter(Boolean);
    const name = parts[parts.length - 1] || path;
    try {
      return decodeURIComponent(name);
    } catch {
      return name;
    }
  }
  const u = String(audioUrl || '').trim();
  if (!u) return '';
  try {
    const clean = u.split('?')[0];
    const parts = clean.split('/').filter(Boolean);
    const name = parts[parts.length - 1] || '';
    return name ? decodeURIComponent(name) : 'Áudio';
  } catch {
    return 'Áudio';
  }
}

function LinkedAudioSection({ nodeId, props, onPatchNode, onOpenAudioLibrary, elementLabel }) {
  const audioUrl = String(props?.audio || '');
  const audioStorage = props?.audioStorage;
  const hasLinked = Boolean(
    audioUrl.trim() || (typeof audioStorage?.filePath === 'string' && audioStorage.filePath.trim()),
  );
  const resolvedSrc = useResolvedStorageUrl(audioUrl, audioStorage);
  const fileLabel = linkedAudioDisplayName(audioUrl, audioStorage);

  return (
    <section>
      <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold text-slate-300">
        <FiMusic className="shrink-0 text-amber-400/90" size={14} aria-hidden />
        Áudio vinculado
      </h3>
      <div className="space-y-3 rounded-lg border border-amber-500/25 bg-slate-950/70 p-3">
        <p className="text-[10px] leading-relaxed text-slate-500">
          Associe narração ou música a {elementLabel}. O leitor do livro pode usar este ficheiro em conjunto com o
          elemento (conforme a app ou visualização).
        </p>

        {!hasLinked ? (
          <div className="rounded-lg border border-dashed border-slate-600 bg-slate-900/90 px-3 py-4">
            <p className="mb-3 text-center text-xs text-slate-400">Nenhum áudio associado a este elemento.</p>
            <button
              type="button"
              onClick={() => onOpenAudioLibrary?.()}
              className="w-full rounded-md bg-amber-600 px-3 py-2.5 text-xs font-semibold text-amber-950 shadow-sm transition-colors hover:bg-amber-500"
            >
              Escolher áudio na biblioteca
            </button>
            <p className="mt-3 text-center text-[10px] leading-snug text-slate-600">
              Abre o painel <span className="text-slate-400">Mídia → Áudios</span>. Com este elemento seleccionado,
              clique num ficheiro para vincular.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-2.5 rounded-md border border-slate-700 bg-slate-900 px-3 py-2.5">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold uppercase tracking-wide text-emerald-400/95">Áudio ligado</div>
                <div className="mt-0.5 truncate font-mono text-[11px] text-slate-200" title={fileLabel || resolvedSrc}>
                  {fileLabel || 'Ficheiro de áudio'}
                </div>
              </div>
            </div>

            {resolvedSrc ? (
              <div className="rounded-md border border-slate-700 bg-slate-900/80 p-2">
                <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Pré-escuta
                </span>
                <audio key={resolvedSrc} controls preload="metadata" className="w-full">
                  <source src={resolvedSrc} />
                </audio>
              </div>
            ) : (
              <p className="rounded border border-amber-500/20 bg-amber-500/5 px-2 py-1.5 text-[10px] text-amber-100/90">
                A obter URL assinada do áudio…
              </p>
            )}

            <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
              <button
                type="button"
                onClick={() => onOpenAudioLibrary?.()}
                className="flex-1 rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-100 transition-colors hover:bg-slate-700"
              >
                Trocar áudio
              </button>
              <button
                type="button"
                onClick={() =>
                  onPatchNode(nodeId, { props: { ...props, audio: '', audioStorage: null } })
                }
                className="flex-1 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-200 transition-colors hover:bg-red-500/20"
              >
                Remover vínculo
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

const BOOK_VIDEO_LAYOUTS = [
  { value: 'standard', label: 'Barra e centro', hint: 'Titulo no topo, play ao centro — classico no editor.' },
  { value: 'poster_card', label: 'Cartao com capa', hint: 'Destaque ao poster/capa; play discreto no canto.' },
  { value: 'minimal_chrome', label: 'Minimal', hint: 'Moldura leve; titulo e play pequenos.' },
];

function VideoBookRepresentationForm({ nodeId, props, onPatchNode }) {
  const layout = BOOK_VIDEO_LAYOUTS.some((o) => o.value === props?.bookVideoLayout)
    ? props.bookVideoLayout
    : 'standard';
  const corner = clamp(toNum(props?.videoCornerRadius, 12), 0, 48);
  const placeholder = String(props?.videoPlaceholderFill || '#111827');

  return (
    <div className="space-y-3 rounded border border-violet-500/30 bg-slate-950/80 p-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-violet-300">Como aparece no livro</div>
      <p className="text-[10px] leading-snug text-slate-500">
        Define o aspecto do quadro de video na pagina (leitores usam estes dados ao renderizar o livro).
      </p>
      <label className="flex flex-col gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Estilo do quadro</span>
        <select
          value={layout}
          onChange={(e) =>
            onPatchNode(nodeId, {
              props: { ...props, bookVideoLayout: e.target.value },
            })
          }
          className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200"
        >
          {BOOK_VIDEO_LAYOUTS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <span className="text-[10px] text-slate-500">{BOOK_VIDEO_LAYOUTS.find((o) => o.value === layout)?.hint}</span>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Titulo no quadro</span>
        <input
          type="text"
          value={String(props?.title ?? '')}
          placeholder="Ex.: Introducao"
          onChange={(e) =>
            onPatchNode(nodeId, {
              props: { ...props, title: e.target.value },
            })
          }
          className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Legenda (opcional)</span>
        <input
          type="text"
          value={String(props?.videoCaption ?? '')}
          placeholder="Uma linha sob o video"
          onChange={(e) =>
            onPatchNode(nodeId, {
              props: { ...props, videoCaption: e.target.value },
            })
          }
          className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200"
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Cantos (px)</span>
          <input
            type="number"
            min={0}
            max={48}
            step={1}
            value={corner}
            onChange={(e) =>
              onPatchNode(nodeId, {
                props: { ...props, videoCornerRadius: clamp(toNum(e.target.value, 12), 0, 48) },
              })
            }
            className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Fundo sem capa</span>
          <input
            type="color"
            value={placeholder}
            onChange={(e) =>
              onPatchNode(nodeId, {
                props: { ...props, videoPlaceholderFill: e.target.value },
              })
            }
            className="h-9 w-full cursor-pointer rounded border border-slate-700 bg-slate-900 p-1"
          />
        </label>
      </div>
      <label className="flex items-center justify-between rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-300">
        Mostrar icone de play no quadro
        <input
          type="checkbox"
          checked={props.showPlayBadge !== false}
          onChange={(e) =>
            onPatchNode(nodeId, {
              props: { ...props, showPlayBadge: e.target.checked },
            })
          }
          className="accent-violet-500"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Velocidade de reproducao</span>
        <select
          value={String(clamp(toNum(props?.playbackRate, 1), 0.25, 2))}
          onChange={(e) =>
            onPatchNode(nodeId, {
              props: { ...props, playbackRate: clamp(toNum(e.target.value, 1), 0.25, 2) },
            })
          }
          className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200"
        >
          <option value="0.5">0.5x</option>
          <option value="0.75">0.75x</option>
          <option value="1">1x (normal)</option>
          <option value="1.25">1.25x</option>
          <option value="1.5">1.5x</option>
          <option value="2">2x</option>
        </select>
      </label>
    </div>
  );
}

function VideoInspectorPreview({ nodeId, props, onPatchNode }) {
  const videoRef = useRef(null);
  const resolved = useResolvedStorageUrl(String(props?.content || ''), props?.storage);
  const posterResolved = useResolvedStorageUrl(String(props?.poster || ''), props?.posterStorage);
  const startAt = Math.max(0, toNum(props?.startAt, 0));
  const volume = clamp(toNum(props?.volume, 1), 0, 1);
  const objectFit = ['cover', 'contain', 'fill'].includes(props?.objectFit) ? props.objectFit : 'cover';
  const playbackRate = clamp(toNum(props?.playbackRate, 1), 0.25, 2);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !resolved) return;
    const onMeta = () => {
      try {
        v.currentTime = startAt;
      } catch {
        /* ignore */
      }
    };
    v.addEventListener('loadedmetadata', onMeta);
    return () => v.removeEventListener('loadedmetadata', onMeta);
  }, [resolved, startAt]);

  useEffect(() => {
    const v = videoRef.current;
    if (v) v.volume = volume;
  }, [volume]);

  useEffect(() => {
    const v = videoRef.current;
    if (v) v.playbackRate = playbackRate;
  }, [playbackRate]);

  if (!resolved) {
    return (
      <div className="rounded border border-slate-700 bg-slate-950 px-2 py-3 text-xs text-slate-500">
        Sem URL de video ou a renovar URL de armazenamento…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <video
        ref={videoRef}
        key={resolved}
        src={resolved}
        poster={posterResolved || undefined}
        controls={props.controls !== false}
        playsInline
        loop={Boolean(props.loop)}
        muted={Boolean(props.muted)}
        className="w-full rounded border border-slate-700 bg-black"
        style={{ maxHeight: '14rem', objectFit }}
      />
      <VideoBookRepresentationForm nodeId={nodeId} props={props} onPatchNode={onPatchNode} />
      <label className="flex flex-col gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Volume</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={(e) =>
            onPatchNode(nodeId, {
              props: { ...props, volume: clamp(toNum(e.target.value, 1), 0, 1) },
            })
          }
          className="w-full accent-indigo-500"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Encaixe no quadro</span>
        <select
          value={objectFit}
          onChange={(e) =>
            onPatchNode(nodeId, {
              props: { ...props, objectFit: e.target.value },
            })
          }
          className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200"
        >
          <option value="cover">Cobrir (cover)</option>
          <option value="contain">Conter (contain)</option>
          <option value="fill">Esticar (fill)</option>
        </select>
      </label>
      <label className="flex items-center justify-between rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-300">
        Controlos nativos (play, tempo)
        <input
          type="checkbox"
          checked={props.controls !== false}
          onChange={(e) =>
            onPatchNode(nodeId, {
              props: { ...props, controls: e.target.checked },
            })
          }
          className="accent-indigo-500"
        />
      </label>
    </div>
  );
}

function PropGridInput({ label, value, onChange, min, max, step }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onChange}
        className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 transition-colors focus:border-indigo-500 focus:outline-none"
      />
    </label>
  );
}

const PAGE_TRANSITION_OPTIONS = [
  { value: 'none', label: 'Sem transicao' },
  { value: 'esmaecer', label: 'Esmaecer' },
  { value: 'fade', label: 'Fade' },
  { value: 'dissolve', label: 'Dissolve' },
  { value: 'push', label: 'Push' },
  { value: 'reveal', label: 'Revelar' },
  { value: 'wipe', label: 'Wipe' },
  { value: 'cover', label: 'Cover' },
  { value: 'uncover', label: 'Uncover' },
  { value: 'shreds', label: 'Desgarrar' },
  { value: 'split', label: 'Split' },
  { value: 'zoom', label: 'Zoom' },
  { value: 'morph', label: 'Morph' },
  { value: 'flash', label: 'Flash' },
];

const DIRECTION_OPTIONS = [
  { value: '', label: 'Automatica' },
  { value: 'left', label: 'Esquerda' },
  { value: 'right', label: 'Direita' },
  { value: 'up', label: 'Cima' },
  { value: 'down', label: 'Baixo' },
];

const ELEMENT_ANIMATION_OPTIONS = [
  { value: '', label: 'Sem animacao' },
  { value: 'animate__fadeIn', label: 'Fade In' },
  { value: 'animate__fadeInUp', label: 'Fade In Up' },
  { value: 'animate__fadeInDown', label: 'Fade In Down' },
  { value: 'animate__fadeInLeft', label: 'Fade In Left' },
  { value: 'animate__fadeInRight', label: 'Fade In Right' },
  { value: 'animate__zoomIn', label: 'Zoom In' },
  { value: 'animate__bounce', label: 'Bounce' },
  { value: 'animate__pulse', label: 'Pulse' },
  { value: 'animate__rubberBand', label: 'Rubber Band' },
  { value: 'animate__slideInLeft', label: 'Slide In Left' },
  { value: 'animate__slideInRight', label: 'Slide In Right' },
];

function AnimationElementSection({
  elementAnimation,
  onPatchAnimation,
  onTestElementAnimation,
}) {
  const [previewKey, setPreviewKey] = useState(0);
  const val = String(elementAnimation || '');

  return (
    <section>
      <h3 className="mb-3 text-xs font-semibold text-slate-300">Animacao do elemento</h3>

      <div className="space-y-3 rounded border border-slate-700 bg-slate-900 p-3">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Selecione a animacao
          </span>
          <select
            value={val}
            onChange={(e) => onPatchAnimation?.(e.target.value)}
            className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200 transition-colors focus:border-indigo-500 focus:outline-none"
          >
            {ELEMENT_ANIMATION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center justify-between gap-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Visualizacao
          </div>
          <button
            type="button"
            onClick={() => {
              if (!val) return;
              setPreviewKey((v) => v + 1);
              onTestElementAnimation?.(val);
            }}
            disabled={!val}
            className="inline-flex items-center gap-2 rounded bg-indigo-600 px-2.5 py-1.5 text-[10px] font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            title="Testar animação"
          >
            <FiPlay size={12} />
            Testar
          </button>
        </div>

        <div className="relative flex h-16 w-full items-center justify-center overflow-hidden rounded border border-slate-800 bg-slate-950">
          <div
            key={previewKey}
            className={`animate__animated ${val || ''}`}
            style={{
              width: 120,
              height: 40,
              borderRadius: 8,
              background: 'rgba(79,70,229,0.22)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 700,
              color: '#e5e7eb',
            }}
          >
            Elem
          </div>
        </div>
      </div>
    </section>
  );
}

function TransitionSection({ transition, onPatchPageTransition, onTestPageTransition }) {
  const currentType = String(transition?.type || 'none');
  const currentDirection = String(transition?.direction || '');
  const currentMs = Math.max(200, Math.min(4000, toNum(transition?.durationMs, 500)));
  const needsDirection =
    currentType === 'push' ||
    currentType === 'reveal' ||
    currentType === 'wipe' ||
    currentType === 'cover' ||
    currentType === 'uncover';

  const [previewStage, setPreviewStage] = useState('end');
  const [previewTick, setPreviewTick] = useState(0);
  const previewKey = `${previewTick}-${currentType}-${currentDirection}`;

  const runPreview = () => {
    if (currentType === 'none') return;
    const safeMs = Math.max(180, Math.min(1000, currentMs));
    setPreviewTick((v) => v + 1);
    setPreviewStage('start');
    window.setTimeout(() => setPreviewStage('end'), safeMs);
  };

  const px = 70;
  const dir = currentDirection.toLowerCase();
  const offset = (() => {
    switch (dir) {
      case 'l':
      case 'left':
        return { x: px, y: 0 };
      case 'r':
      case 'right':
        return { x: -px, y: 0 };
      case 'u':
      case 'up':
      case 't':
      case 'top':
        return { x: 0, y: px };
      case 'd':
      case 'down':
      case 'b':
      case 'bottom':
        return { x: 0, y: -px };
      default:
        return { x: px, y: 0 };
    }
  })();

  const invertWipe = currentType === 'cover';
  const effectiveOffset = invertWipe ? { x: -offset.x, y: -offset.y } : offset;

  const initialTransform = (() => {
    switch (currentType) {
      case 'fade':
      case 'dissolve':
      case 'esmaecer':
        return 'translate(0px, 0px) scale(1)';
      case 'zoom':
      case 'morph':
        return 'translate(0px, 0px) scale(0.92)';
      case 'push':
      case 'reveal':
        return `translate(${effectiveOffset.x}px, ${effectiveOffset.y}px) scale(1)`;
      case 'wipe':
      case 'uncover':
      case 'cover':
        return `translate(${effectiveOffset.x}px, ${effectiveOffset.y}px) scale(1)`;
      case 'split':
        return 'translate(0px, 0px) scale(1)';
      case 'shreds':
        return 'translate(8px, 0px) scale(1)';
      default:
        return 'translate(0px, 0px) scale(1)';
    }
  })();

  const initialOpacity = (() => {
    switch (currentType) {
      case 'fade':
      case 'dissolve':
      case 'esmaecer':
        return 0;
      case 'zoom':
      case 'morph':
      case 'reveal':
        return 0.92;
      case 'shreds':
        return 0.75;
      default:
        return 0;
    }
  })();

  const previewTransition = `${Math.max(180, Math.min(1000, currentMs))}ms ease-in-out`;

  return (
    <section>
      <h3 className="mb-3 text-xs font-semibold text-slate-300">Transicao da pagina</h3>
      <div className="space-y-3 rounded border border-slate-700 bg-slate-900 p-3">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Tipo
          </span>
          <select
            className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200"
            value={currentType}
            onChange={(e) =>
              onPatchPageTransition?.({
                type: e.target.value,
                durationMs: currentMs,
                direction: needsDirection ? currentDirection : null,
              })
            }
          >
            {PAGE_TRANSITION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Duracao (ms)
          </span>
          <input
            type="number"
            min={200}
            max={4000}
            step={50}
            value={currentMs}
            onChange={(e) =>
              onPatchPageTransition?.({
                type: currentType,
                durationMs: Math.max(200, Math.min(4000, toNum(e.target.value, 500))),
                direction: needsDirection ? currentDirection : null,
              })
            }
            className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200"
          />
        </label>

        {needsDirection ? (
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Direcao
            </span>
            <select
              className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200"
              value={currentDirection}
              onChange={(e) =>
                onPatchPageTransition?.({
                  type: currentType,
                  durationMs: currentMs,
                  direction: e.target.value || null,
                })
              }
            >
              {DIRECTION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="flex items-center justify-between gap-2 pt-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Visualizacao
          </div>
          <button
            type="button"
            onClick={() => {
              if (currentType === 'none') return;
              runPreview();
              onTestPageTransition?.({
                type: currentType,
                direction: currentDirection,
                durationMs: currentMs,
              });
            }}
            className="inline-flex items-center gap-2 rounded bg-indigo-600 px-2.5 py-1.5 text-[10px] font-semibold text-white transition-colors hover:bg-indigo-500"
            title="Testar transição"
          >
            <FiPlay size={12} />
            Testar
          </button>
        </div>

        <div className="relative h-20 w-full overflow-hidden rounded border border-slate-700 bg-slate-950">
          <div
            key={previewKey}
            className="absolute inset-0 flex items-center justify-center"
            style={{
              transition: `transform ${previewTransition}, opacity ${previewTransition}`,
              transform: previewStage === 'start' ? initialTransform : 'translate(0px, 0px) scale(1)',
              opacity: previewStage === 'start' ? initialOpacity : 1,
            }}
          >
            <span className="text-[10px] font-bold text-slate-200">
              {currentType}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function PropertiesInspector({
  page,
  selectedNodeId,
  onPatchNode,
  onDeleteNode,
  onOpenAudioLibrary,
  onPatchPageTransition,
  showPageTransitionEditor = false,
  onTestElementAnimation,
  onTestPageTransition,
}) {
  const textAreaRef = useRef(null);
  const nodes = Array.isArray(page?.nodes) ? page.nodes : [];
  const [shapeEditorOpen, setShapeEditorOpen] = useState(false);
  const pageTransition = page?.meta?.transition || {
    type: 'none',
    durationMs: 500,
    direction: null,
  };
  const selectedNode = useMemo(
    () => nodes.find((n) => String(n?.id) === String(selectedNodeId)) || null,
    [nodes, selectedNodeId],
  );
  const isShape = selectedNode?.type === 'shape';

  useEffect(() => {
    if (!isShape) setShapeEditorOpen(false);
  }, [isShape, selectedNode?.id]);

  useEffect(() => {
    if (!shapeEditorOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setShapeEditorOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shapeEditorOpen]);

  if (!selectedNode) {
    return (
      <div className="flex min-h-0 flex-1 flex-col bg-slate-800 text-slate-200">
        <div className="shrink-0 border-b border-slate-700 bg-slate-900 px-4 py-3">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-100">
            Propriedades
          </div>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden p-4">
          {showPageTransitionEditor ? (
            <TransitionSection
              transition={pageTransition}
              onPatchPageTransition={onPatchPageTransition}
              onTestPageTransition={onTestPageTransition}
            />
          ) : null}
          <div className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-400">
            Selecione um elemento na pagina para editar propriedades.
          </div>
        </div>
      </div>
    );
  }

  const transform = selectedNode.transform || {};
  const props = selectedNode.props || {};
  const shapeProps =
    props.shapeProperties && typeof props.shapeProperties === 'object' && !Array.isArray(props.shapeProperties)
      ? props.shapeProperties
      : {};
  const isText = selectedNode.type === 'text';
  const isImage = selectedNode.type === 'image';
  const isVideo = selectedNode.type === 'video';
  const supportsAudioBinding = isText || isImage || isVideo;
  const supportsEffects = isText || isShape || isVideo;
  const supportsTextEditing = isText || isShape;

  const applyInlineMark = (marker) => {
    if (!supportsTextEditing) return;
    const el = textAreaRef.current;
    if (!el || typeof el.selectionStart !== 'number' || typeof el.selectionEnd !== 'number') return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    if (start === end) return;

    const richSpans = Array.isArray(props.richSpans) ? [...props.richSpans] : [];
    const key =
      marker === 'bold' ? 'bold' : marker === 'italic' ? 'italic' : 'underline';

    const fullyCovered = richSpans.some(
      (s) =>
        toNum(s?.start, -1) <= start &&
        toNum(s?.end, -1) >= end &&
        Boolean(s?.[key]) === true,
    );

    const nextSpans = fullyCovered
      ? richSpans
          .map((s) => {
            const ss = toNum(s?.start, 0);
            const ee = toNum(s?.end, 0);
            if (ss <= start && ee >= end && s?.[key]) {
              const clone = { ...s };
              delete clone[key];
              return clone;
            }
            return s;
          })
          .filter((s) => s.bold || s.italic || s.underline)
      : [...richSpans, { start, end, [key]: true }];

    onPatchNode(selectedNode.id, { props: { ...props, richSpans: nextSpans } });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-slate-800 text-slate-200">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-700 bg-slate-900 px-4 py-3">
        <div className="flex items-center gap-2">
          {isText ? (
            <FiType className="text-indigo-400" />
          ) : isImage ? (
            <FiImage className="text-emerald-400" />
          ) : isVideo ? (
            <FiVideo className="text-violet-400" />
          ) : (
            <FiMaximize className="text-sky-400" />
          )}
          <span className="text-xs font-bold uppercase tracking-wide text-slate-100">
            {selectedNode.type}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onDeleteNode(selectedNode.id)}
          className="rounded p-1.5 text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-400"
          title="Remover elemento"
        >
          <FiTrash2 size={14} />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overflow-x-hidden p-4">
        {showPageTransitionEditor ? (
          <>
            <TransitionSection
              transition={pageTransition}
              onPatchPageTransition={onPatchPageTransition}
              onTestPageTransition={onTestPageTransition}
            />
            <hr className="border-slate-700" />
          </>
        ) : null}
        <AnimationElementSection
          elementAnimation={selectedNode.animation}
          onPatchAnimation={(value) => onPatchNode(selectedNode.id, { animation: value })}
          onTestElementAnimation={onTestElementAnimation}
        />
        <section>
          <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold text-slate-300">
            Transformacao
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                X
              </span>
              <input
                type="number"
                className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 transition-colors focus:border-indigo-500 focus:outline-none"
                value={toNum(transform.x, 0)}
                onChange={(e) =>
                  onPatchNode(selectedNode.id, {
                    transform: { ...transform, x: toNum(e.target.value, 0) },
                  })
                }
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Y
              </span>
              <input
                type="number"
                className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 transition-colors focus:border-indigo-500 focus:outline-none"
                value={toNum(transform.y, 0)}
                onChange={(e) =>
                  onPatchNode(selectedNode.id, {
                    transform: { ...transform, y: toNum(e.target.value, 0) },
                  })
                }
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Largura
              </span>
              <input
                type="number"
                className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 transition-colors focus:border-indigo-500 focus:outline-none"
                value={toNum(transform.width, 120)}
                onChange={(e) =>
                  onPatchNode(selectedNode.id, {
                    transform: {
                      ...transform,
                      width: Math.max(1, toNum(e.target.value, 120)),
                    },
                  })
                }
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Altura
              </span>
              <input
                type="number"
                className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 transition-colors focus:border-indigo-500 focus:outline-none"
                value={toNum(transform.height, 80)}
                onChange={(e) =>
                  onPatchNode(selectedNode.id, {
                    transform: {
                      ...transform,
                      height: Math.max(1, toNum(e.target.value, 80)),
                    },
                  })
                }
              />
            </label>
            <label className="col-span-2 flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Rotacao (graus)
              </span>
              <input
                type="number"
                className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 transition-colors focus:border-indigo-500 focus:outline-none"
                value={toNum(transform.rotation, 0)}
                onChange={(e) =>
                  onPatchNode(selectedNode.id, {
                    transform: {
                      ...transform,
                      rotation: toNum(e.target.value, 0),
                    },
                  })
                }
              />
            </label>
          </div>
        </section>

        {isShape ? (
          <section>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold text-slate-300">Forma</h3>
              <button
                type="button"
                className="rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-[10px] font-semibold text-slate-200 hover:bg-slate-700"
                onClick={() => setShapeEditorOpen(true)}
              >
                Editor completo
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="col-span-2 flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Tipo da forma
                </span>
                <select
                  className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 transition-colors focus:border-indigo-500 focus:outline-none"
                  value={String(shapeProps.type || 'rectangle')}
                  onChange={(e) =>
                    onPatchNode(selectedNode.id, {
                      props: {
                        ...props,
                        shapeProperties: {
                          ...shapeProps,
                          type: e.target.value,
                        },
                      },
                    })
                  }
                >
                  <option value="rectangle">Retangulo</option>
                  <option value="circle">Circulo</option>
                  <option value="triangle">Triangulo</option>
                  <option value="star">Estrela</option>
                  <option value="arrow">Seta</option>
                  <option value="diamond">Losango</option>
                  <option value="hexagon">Hexagono</option>
                  <option value="line">Linha</option>
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Cor de fundo
                </span>
                <input
                  type="color"
                  value={String(shapeProps.fill || '#fcfdff')}
                  onChange={(e) =>
                    onPatchNode(selectedNode.id, {
                      props: {
                        ...props,
                        shapeProperties: {
                          ...shapeProps,
                          fill: e.target.value,
                        },
                      },
                    })
                  }
                  className="h-8 w-full cursor-pointer rounded border border-slate-700 bg-slate-900 p-1"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Cor da borda
                </span>
                <input
                  type="color"
                  value={String(props.strokeColor || '#000000')}
                  onChange={(e) =>
                    onPatchNode(selectedNode.id, {
                      props: { ...props, strokeColor: e.target.value },
                    })
                  }
                  className="h-8 w-full cursor-pointer rounded border border-slate-700 bg-slate-900 p-1"
                />
              </label>

              <PropGridInput
                label="Espessura da borda"
                value={toNum(props.strokeWidth, 2)}
                min={0}
                max={24}
                step={1}
                onChange={(e) =>
                  onPatchNode(selectedNode.id, {
                    props: { ...props, strokeWidth: Math.max(0, toNum(e.target.value, 2)) },
                  })
                }
              />

              <PropGridInput
                label="Raio dos cantos"
                value={toNum(shapeProps.borderRadius, 0)}
                min={0}
                max={120}
                step={1}
                onChange={(e) =>
                  onPatchNode(selectedNode.id, {
                    props: {
                      ...props,
                      shapeProperties: {
                        ...shapeProps,
                        borderRadius: Math.max(0, toNum(e.target.value, 0)),
                      },
                    },
                  })
                }
              />
            </div>
          </section>
        ) : null}

        <section>
          <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-300">
            <FiLayers size={13} className="text-amber-400" />
            Etapas da apresentacao
          </h3>
          <p className="mb-3 text-[10px] leading-relaxed text-slate-500">
            Na timeline (separador <span className="text-slate-400">Timeline</span>), cada coluna numerada é uma etapa. O elemento entra na sequência na etapa que definir aqui; use o play ou os números em baixo para pré-visualizar.
          </p>
          <PropGridInput
            label="Etapa de entrada (0 = desde o início)"
            value={Math.max(0, Math.min(MAX_TIMELINE_STEP, Math.trunc(toNum(selectedNode.step, 0))))}
            min={0}
            max={MAX_TIMELINE_STEP}
            step={1}
            onChange={(e) => {
              const v = Math.max(0, Math.min(MAX_TIMELINE_STEP, Math.trunc(toNum(e.target.value, 0))));
              onPatchNode(selectedNode.id, { step: v });
            }}
          />

          <div className="mt-4 rounded border border-slate-700 bg-slate-900/40 p-2">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Camada (ordem visual)
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  onPatchNode(selectedNode.id, {
                    zIndex: Math.max(0, Math.trunc(toNum(selectedNode.zIndex, 0)) - 1),
                  })
                }
                className="rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-300 transition-colors hover:bg-slate-800"
                title="Descer um nível"
              >
                Descer 1
              </button>
              <button
                type="button"
                onClick={() =>
                  onPatchNode(selectedNode.id, {
                    zIndex: Math.max(0, Math.trunc(toNum(selectedNode.zIndex, 0)) + 1),
                  })
                }
                className="rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-300 transition-colors hover:bg-slate-800"
                title="Subir um nível"
              >
                Subir 1
              </button>
              <button
                type="button"
                onClick={() => onPatchNode(selectedNode.id, { zIndex: 0 })}
                className="rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-300 transition-colors hover:bg-slate-800"
                title="Enviar para trás de todos"
              >
                Enviar para trás
              </button>
              <button
                type="button"
                onClick={() => onPatchNode(selectedNode.id, { zIndex: 9999 })}
                className="rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-300 transition-colors hover:bg-slate-800"
                title="Trazer para frente de todos"
              >
                Trazer para frente
              </button>
            </div>
            <div className="mt-2 text-[10px] text-slate-500">
              Camada atual: <span className="text-slate-300">{Math.max(0, Math.trunc(toNum(selectedNode.zIndex, 0)))}</span>
            </div>
          </div>
        </section>

        <hr className="border-slate-700" />

        {supportsEffects ? (
          <section>
            <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold text-slate-300">
              <FiSettings size={13} />
              Efeitos visuais
            </h3>

            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Opacidade
              </span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={toNum(props.opacity, 1)}
                onChange={(e) =>
                  onPatchNode(selectedNode.id, {
                    props: { ...props, opacity: toNum(e.target.value, 1) },
                  })
                }
                className="w-28 accent-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <PropGridInput
                label="Contorno"
                value={toNum(props.strokeWidth, 0)}
                min={0}
                max={24}
                step={1}
                onChange={(e) =>
                  onPatchNode(selectedNode.id, {
                    props: { ...props, strokeWidth: Math.max(0, toNum(e.target.value, 0)) },
                  })
                }
              />
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Cor contorno
                </span>
                <input
                  type="color"
                  value={String(props.strokeColor || '#000000')}
                  onChange={(e) =>
                    onPatchNode(selectedNode.id, {
                      props: { ...props, strokeColor: e.target.value },
                    })
                  }
                  className="h-8 w-full cursor-pointer rounded border border-slate-700 bg-slate-900 p-1"
                />
              </label>
              <PropGridInput
                label="Sombra blur"
                value={toNum(props.shadowBlur, 0)}
                min={0}
                max={80}
                step={1}
                onChange={(e) =>
                  onPatchNode(selectedNode.id, {
                    props: { ...props, shadowBlur: Math.max(0, toNum(e.target.value, 0)) },
                  })
                }
              />
              <PropGridInput
                label="Sombra opacidade"
                value={toNum(props.shadowOpacity, 0)}
                min={0}
                max={1}
                step={0.05}
                onChange={(e) =>
                  onPatchNode(selectedNode.id, {
                    props: {
                      ...props,
                      shadowOpacity: Math.max(0, Math.min(1, toNum(e.target.value, 0))),
                    },
                  })
                }
              />
              <PropGridInput
                label="Sombra X"
                value={toNum(props.shadowOffsetX, 0)}
                step={1}
                onChange={(e) =>
                  onPatchNode(selectedNode.id, {
                    props: { ...props, shadowOffsetX: toNum(e.target.value, 0) },
                  })
                }
              />
              <PropGridInput
                label="Sombra Y"
                value={toNum(props.shadowOffsetY, 0)}
                step={1}
                onChange={(e) =>
                  onPatchNode(selectedNode.id, {
                    props: { ...props, shadowOffsetY: toNum(e.target.value, 0) },
                  })
                }
              />
              <label className="col-span-2 flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Cor sombra
                </span>
                <input
                  type="color"
                  value={String(props.shadowColor || '#000000')}
                  onChange={(e) =>
                    onPatchNode(selectedNode.id, {
                      props: {
                        ...props,
                        shadowColor: e.target.value,
                        shadowOpacity:
                          props.shadowOpacity == null ? 0.5 : toNum(props.shadowOpacity, 0.5),
                      },
                    })
                  }
                  className="h-8 w-full cursor-pointer rounded border border-slate-700 bg-slate-900 p-1"
                />
              </label>
            </div>
          </section>
        ) : null}

        {supportsEffects ? <hr className="border-slate-700" /> : null}

        {supportsTextEditing ? (
          <section>
            <h3 className="mb-3 text-xs font-semibold text-slate-300">
              {isShape ? 'Texto da forma' : 'Tipografia e conteudo'}
            </h3>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Texto
              </span>
              <textarea
                ref={textAreaRef}
                className="h-24 w-full resize-none rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 transition-colors focus:border-indigo-500 focus:outline-none"
                value={String(props.content || '')}
                onChange={(e) =>
                  onPatchNode(selectedNode.id, {
                    props: { ...props, content: e.target.value, richSpans: [] },
                  })
                }
              />
            </label>

            <div className="mt-2 rounded border border-slate-700 bg-slate-900/50 p-2">
              <div className="mb-2 text-[10px] uppercase tracking-wider text-slate-500">
                Selecione um trecho no campo acima e aplique a formatacao
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => applyInlineMark('bold')}
                  className="min-w-0 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-300 transition-colors hover:bg-slate-800"
                  title="Negrito no trecho"
                >
                  <span className="inline-flex min-w-0 items-center gap-1 truncate">
                    <FiBold size={12} />
                    Negrito
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => applyInlineMark('italic')}
                  className="min-w-0 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-300 transition-colors hover:bg-slate-800"
                  title="Italico no trecho"
                >
                  <span className="inline-flex min-w-0 items-center gap-1 truncate">
                    <FiItalic size={12} />
                    Italico
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => applyInlineMark('underline')}
                  className="col-span-2 min-w-0 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-300 transition-colors hover:bg-slate-800"
                  title="Sublinhado no trecho"
                >
                  <span className="inline-flex min-w-0 items-center gap-1 truncate">
                    <FiUnderline size={12} />
                    Sublinhado
                  </span>
                </button>
              </div>
            </div>
            <label className="mt-3 flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Fonte
              </span>
              <select
                className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 transition-colors focus:border-indigo-500 focus:outline-none"
                value={String(props.fontFamily || 'Roboto')}
                onChange={(e) =>
                  onPatchNode(selectedNode.id, {
                    props: { ...props, fontFamily: e.target.value },
                  })
                }
              >
                {EDITOR_FONT_OPTIONS.map((font) => (
                  <option key={font} value={font}>
                    {font}
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-3 flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Tamanho da fonte
              </span>
              <input
                type="number"
                className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 transition-colors focus:border-indigo-500 focus:outline-none"
                value={toNum(props.fontSize, 24)}
                onChange={(e) =>
                  onPatchNode(selectedNode.id, {
                    props: { ...props, fontSize: toNum(e.target.value, 24) },
                  })
                }
              />
            </label>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Cor do texto
                </span>
                <input
                  type="color"
                  value={String(props.color || '#111111')}
                  onChange={(e) =>
                    onPatchNode(selectedNode.id, {
                      props: { ...props, color: e.target.value },
                    })
                  }
                  className="h-8 w-full cursor-pointer rounded border border-slate-700 bg-slate-900 p-1"
                />
              </label>
            </div>

            <div className="mt-3">
              <span className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Estilo
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    onPatchNode(selectedNode.id, {
                      props: {
                        ...props,
                        fontWeight: props.fontWeight === 'bold' ? 'normal' : 'bold',
                      },
                    })
                  }
                  className={`min-w-0 rounded border px-2 py-1 text-xs transition-colors ${
                    props.fontWeight === 'bold'
                      ? 'border-indigo-500 bg-indigo-600 text-white'
                      : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  Negrito
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onPatchNode(selectedNode.id, {
                      props: {
                        ...props,
                        fontStyle: props.fontStyle === 'italic' ? 'normal' : 'italic',
                      },
                    })
                  }
                  className={`min-w-0 rounded border px-2 py-1 text-xs transition-colors ${
                    props.fontStyle === 'italic'
                      ? 'border-indigo-500 bg-indigo-600 text-white'
                      : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  Italico
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onPatchNode(selectedNode.id, {
                      props: {
                        ...props,
                        textDecoration:
                          props.textDecoration === 'underline' ? 'none' : 'underline',
                      },
                    })
                  }
                  className={`col-span-2 min-w-0 rounded border px-2 py-1 text-xs transition-colors ${
                    props.textDecoration === 'underline'
                      ? 'border-indigo-500 bg-indigo-600 text-white'
                      : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  Sublinhado
                </button>
              </div>
            </div>

            <div className="mt-3">
              <span className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Alinhamento
              </span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    onPatchNode(selectedNode.id, {
                      props: { ...props, textAlign: 'left' },
                    })
                  }
                  className={`flex items-center justify-center rounded border px-2 py-1 text-xs transition-colors ${
                    (props.textAlign || 'left') === 'left'
                      ? 'border-indigo-500 bg-indigo-600 text-white'
                      : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
                  }`}
                  title="Alinhar a esquerda"
                >
                  <FiAlignLeft size={13} />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onPatchNode(selectedNode.id, {
                      props: { ...props, textAlign: 'center' },
                    })
                  }
                  className={`flex items-center justify-center rounded border px-2 py-1 text-xs transition-colors ${
                    props.textAlign === 'center'
                      ? 'border-indigo-500 bg-indigo-600 text-white'
                      : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
                  }`}
                  title="Centralizar"
                >
                  <FiAlignCenter size={13} />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onPatchNode(selectedNode.id, {
                      props: { ...props, textAlign: 'right' },
                    })
                  }
                  className={`flex items-center justify-center rounded border px-2 py-1 text-xs transition-colors ${
                    props.textAlign === 'right'
                      ? 'border-indigo-500 bg-indigo-600 text-white'
                      : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
                  }`}
                  title="Alinhar a direita"
                >
                  <FiAlignRight size={13} />
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {isImage || isVideo ? (
          <section>
            <h3 className="mb-3 text-xs font-semibold text-slate-300">Midia</h3>
            <div className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-400">
              {isVideo
                ? 'Video da biblioteca: ajuste reproducao abaixo e a aparencia do quadro na pagina na caixa roxa.'
                : 'Imagem vinculada pela biblioteca de midia.'}
            </div>
            {isVideo ? (
              <>
                <div className="mt-3 rounded border border-slate-700 bg-slate-900 p-3">
                  <VideoInspectorPreview nodeId={selectedNode.id} props={props} onPatchNode={onPatchNode} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 rounded border border-slate-700 bg-slate-900 p-3">
                <label className="col-span-2 flex items-center justify-between rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-300">
                  Reproduzir automaticamente
                  <input
                    type="checkbox"
                    checked={Boolean(props.autoplay)}
                    onChange={(e) =>
                      onPatchNode(selectedNode.id, {
                        props: { ...props, autoplay: e.target.checked },
                      })
                    }
                    className="accent-indigo-500"
                  />
                </label>
                <label className="flex items-center justify-between rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-300">
                  Em loop
                  <input
                    type="checkbox"
                    checked={Boolean(props.loop)}
                    onChange={(e) =>
                      onPatchNode(selectedNode.id, {
                        props: { ...props, loop: e.target.checked },
                      })
                    }
                    className="accent-indigo-500"
                  />
                </label>
                <label className="flex items-center justify-between rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-300">
                  Iniciar mudo
                  <input
                    type="checkbox"
                    checked={Boolean(props.muted)}
                    onChange={(e) =>
                      onPatchNode(selectedNode.id, {
                        props: { ...props, muted: e.target.checked },
                      })
                    }
                    className="accent-indigo-500"
                  />
                </label>
                <label className="col-span-2 flex flex-col gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Inicio (segundos)
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200"
                    value={Math.max(0, toNum(props.startAt, 0))}
                    onChange={(e) =>
                      onPatchNode(selectedNode.id, {
                        props: { ...props, startAt: Math.max(0, toNum(e.target.value, 0)) },
                      })
                    }
                  />
                </label>
                </div>
              </>
            ) : null}
          </section>
        ) : null}

        {supportsAudioBinding ? (
          <LinkedAudioSection
            nodeId={selectedNode.id}
            props={props}
            onPatchNode={onPatchNode}
            onOpenAudioLibrary={onOpenAudioLibrary}
            elementLabel={isVideo ? 'este vídeo' : isImage ? 'esta imagem' : 'este texto'}
          />
        ) : null}
      </div>

      {isShape && shapeEditorOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed inset-0 z-[220] flex items-center justify-center bg-black/70 p-4"
              role="presentation"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setShapeEditorOpen(false);
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                className="w-full max-w-3xl overflow-hidden rounded-xl border border-slate-600 bg-slate-800 shadow-xl"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100">Editor completo da forma</h3>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Ajuste geometria e estilo da forma selecionada no canvas em tempo real.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700"
                    onClick={() => setShapeEditorOpen(false)}
                  >
                    Fechar
                  </button>
                </div>

                <div className="grid max-h-[78vh] gap-4 overflow-y-auto p-4 lg:grid-cols-2">
                  <section className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
                    <div className="mb-3 text-xs font-semibold text-slate-200">Geometria</div>
                    <div className="grid grid-cols-2 gap-3">
                      <PropGridInput
                        label="X"
                        value={toNum(transform.x, 0)}
                        onChange={(e) =>
                          onPatchNode(selectedNode.id, {
                            transform: { ...transform, x: toNum(e.target.value, 0) },
                          })
                        }
                      />
                      <PropGridInput
                        label="Y"
                        value={toNum(transform.y, 0)}
                        onChange={(e) =>
                          onPatchNode(selectedNode.id, {
                            transform: { ...transform, y: toNum(e.target.value, 0) },
                          })
                        }
                      />
                      <PropGridInput
                        label="Largura"
                        min={1}
                        value={toNum(transform.width, 120)}
                        onChange={(e) =>
                          onPatchNode(selectedNode.id, {
                            transform: { ...transform, width: Math.max(1, toNum(e.target.value, 120)) },
                          })
                        }
                      />
                      <PropGridInput
                        label="Altura"
                        min={1}
                        value={toNum(transform.height, 80)}
                        onChange={(e) =>
                          onPatchNode(selectedNode.id, {
                            transform: { ...transform, height: Math.max(1, toNum(e.target.value, 80)) },
                          })
                        }
                      />
                      <div className="col-span-2">
                        <PropGridInput
                          label="Rotação"
                          value={toNum(transform.rotation, 0)}
                          onChange={(e) =>
                            onPatchNode(selectedNode.id, {
                              transform: { ...transform, rotation: toNum(e.target.value, 0) },
                            })
                          }
                        />
                      </div>
                    </div>
                  </section>

                  <section className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
                    <div className="mb-3 text-xs font-semibold text-slate-200">Estilo</div>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="flex flex-col gap-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Preenchimento</span>
                        <input
                          type="color"
                          value={String(shapeProps.fill || '#fcfdff')}
                          onChange={(e) =>
                            onPatchNode(selectedNode.id, {
                              props: {
                                ...props,
                                shapeProperties: { ...shapeProps, fill: e.target.value },
                              },
                            })
                          }
                          className="h-8 w-full cursor-pointer rounded border border-slate-700 bg-slate-900 p-1"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Borda</span>
                        <input
                          type="color"
                          value={String(props.strokeColor || '#000000')}
                          onChange={(e) =>
                            onPatchNode(selectedNode.id, { props: { ...props, strokeColor: e.target.value } })
                          }
                          className="h-8 w-full cursor-pointer rounded border border-slate-700 bg-slate-900 p-1"
                        />
                      </label>
                      <PropGridInput
                        label="Espessura"
                        value={toNum(props.strokeWidth, 2)}
                        min={0}
                        max={24}
                        onChange={(e) =>
                          onPatchNode(selectedNode.id, {
                            props: { ...props, strokeWidth: Math.max(0, toNum(e.target.value, 2)) },
                          })
                        }
                      />
                      <PropGridInput
                        label="Raio"
                        value={toNum(shapeProps.borderRadius, 0)}
                        min={0}
                        max={120}
                        onChange={(e) =>
                          onPatchNode(selectedNode.id, {
                            props: {
                              ...props,
                              shapeProperties: { ...shapeProps, borderRadius: Math.max(0, toNum(e.target.value, 0)) },
                            },
                          })
                        }
                      />
                      <PropGridInput
                        label="Opacidade"
                        value={clamp(toNum(props.opacity, 1), 0, 1)}
                        min={0}
                        max={1}
                        step={0.05}
                        onChange={(e) =>
                          onPatchNode(selectedNode.id, {
                            props: { ...props, opacity: clamp(toNum(e.target.value, 1), 0, 1) },
                          })
                        }
                      />
                      <PropGridInput
                        label="Sombra blur"
                        value={Math.max(0, toNum(props.shadowBlur, 0))}
                        min={0}
                        max={80}
                        onChange={(e) =>
                          onPatchNode(selectedNode.id, {
                            props: { ...props, shadowBlur: Math.max(0, toNum(e.target.value, 0)) },
                          })
                        }
                      />
                    </div>
                  </section>
                </div>

                <div className="flex justify-end border-t border-slate-700 bg-slate-900/50 px-4 py-3">
                  <button
                    type="button"
                    className="rounded-md bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
                    onClick={() => setShapeEditorOpen(false)}
                  >
                    Guardar e fechar
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
