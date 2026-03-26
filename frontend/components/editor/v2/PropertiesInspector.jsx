import React, { useEffect, useMemo, useRef, useState } from 'react';
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
} from 'react-icons/fi';

import 'animate.css';

function toNum(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
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

const FONT_OPTIONS = [
  'Roboto',
  'Open Sans',
  'Poppins',
  'Nunito',
  'Merriweather',
  'Montserrat',
  'Lato',
  'Inter',
  'Century Gothic',
  'Bookman Old Style',
  'Arial',
  'Verdana',
  'Tahoma',
  'Georgia',
  'Times New Roman',
  'Trebuchet MS',
  'Courier New',
];

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
  const pageTransition = page?.meta?.transition || {
    type: 'none',
    durationMs: 500,
    direction: null,
  };
  const selectedNode = useMemo(
    () => nodes.find((n) => String(n?.id) === String(selectedNodeId)) || null,
    [nodes, selectedNodeId],
  );
  if (!selectedNode) {
    return (
      <div className="flex h-full flex-col bg-slate-800 text-slate-200">
        <div className="border-b border-slate-700 bg-slate-900 px-4 py-3">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-100">
            Propriedades
          </div>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
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
  const isText = selectedNode.type === 'text';
  const isImage = selectedNode.type === 'image';
  const isShape = selectedNode.type === 'shape';
  const supportsAudioBinding = isText || isImage;
  const supportsEffects = isText || isShape;

  const applyInlineMark = (marker) => {
    if (!isText) return;
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
    <div className="flex h-full flex-col bg-slate-800 text-slate-200">
      <div className="flex items-center justify-between border-b border-slate-700 bg-slate-900 px-4 py-3">
        <div className="flex items-center gap-2">
          {isText ? (
            <FiType className="text-indigo-400" />
          ) : isImage ? (
            <FiImage className="text-emerald-400" />
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

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4">
        {showPageTransitionEditor ? (
          <>
            <TransitionSection
              transition={pageTransition}
              onPatchPageTransition={onPatchPageTransition}
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
            value={Math.max(0, Math.min(20, Math.trunc(toNum(selectedNode.step, 0))))}
            min={0}
            max={20}
            step={1}
            onChange={(e) => {
              const v = Math.max(0, Math.min(20, Math.trunc(toNum(e.target.value, 0))));
              onPatchNode(selectedNode.id, { step: v });
            }}
          />
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

        {isText ? (
          <section>
            <h3 className="mb-3 text-xs font-semibold text-slate-300">
              Tipografia e conteudo
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
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => applyInlineMark('bold')}
                  className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-300 transition-colors hover:bg-slate-800"
                  title="Negrito no trecho"
                >
                  <span className="inline-flex items-center gap-1">
                    <FiBold size={12} />
                    Negrito
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => applyInlineMark('italic')}
                  className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-300 transition-colors hover:bg-slate-800"
                  title="Italico no trecho"
                >
                  <span className="inline-flex items-center gap-1">
                    <FiItalic size={12} />
                    Italico
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => applyInlineMark('underline')}
                  className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-300 transition-colors hover:bg-slate-800"
                  title="Sublinhado no trecho"
                >
                  <span className="inline-flex items-center gap-1">
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
                {FONT_OPTIONS.map((font) => (
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
              <div className="grid grid-cols-3 gap-2">
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
                  className={`rounded border px-2 py-1 text-xs transition-colors ${
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
                  className={`rounded border px-2 py-1 text-xs transition-colors ${
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
                  className={`rounded border px-2 py-1 text-xs transition-colors ${
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

        {isImage ? (
          <section>
            <h3 className="mb-3 text-xs font-semibold text-slate-300">Midia</h3>
            <div className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-400">
              Imagem vinculada pela biblioteca de midia.
            </div>
          </section>
        ) : null}

        {supportsAudioBinding ? (
          <section>
            <h3 className="mb-3 text-xs font-semibold text-slate-300">Audio vinculado</h3>
            <div className="space-y-2 rounded border border-slate-700 bg-slate-900 p-3">
              <input
                type="text"
                readOnly
                value={String(props.audio || '')}
                placeholder="Nenhum audio vinculado."
                className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-300"
              />
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onOpenAudioLibrary?.()}
                  className="rounded border border-slate-700 bg-slate-800 px-2 py-2 text-xs text-slate-200 transition-colors hover:bg-slate-700"
                >
                  Vincular da midia
                </button>
                <button
                  type="button"
                  onClick={() => onPatchNode(selectedNode.id, { props: { ...props, audio: '', audioStorage: null } })}
                  className="rounded border border-red-500/40 bg-red-500/10 px-2 py-2 text-xs text-red-300 transition-colors hover:bg-red-500/20"
                >
                  Remover audio
                </button>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
