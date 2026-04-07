import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FiBox,
  FiImage,
  FiMousePointer,
  FiPause,
  FiPlay,
  FiSkipBack,
  FiSkipForward,
  FiType,
  FiVideo,
  FiVolume2,
} from 'react-icons/fi';
import StorageBackedHtmlImage from './StorageBackedHtmlImage';
import { MAX_TIMELINE_STEP, MIN_VISIBLE_TIMELINE_STEPS } from './editorConstants';

function clampInt(n, min, max) {
  const v = Number.isFinite(Number(n)) ? Math.trunc(Number(n)) : 0;
  return Math.max(min, Math.min(max, v));
}

function getTrackInfo(el) {
  if (!el) return { name: 'Outros', icon: <FiBox size={12} /> };
  if (el.type === 'audio') return { name: 'Audio (Cena)', icon: <FiVolume2 size={12} /> };
  if (el.type === 'text') return { name: 'Textos', icon: <FiType size={12} /> };
  if (el.type === 'image') return { name: 'Imagens', icon: <FiImage size={12} /> };
  if (el.type === 'video') return { name: 'Videos', icon: <FiVideo size={12} /> };
  if (el.type === 'shape') return { name: 'Interacoes', icon: <FiMousePointer size={12} /> };
  return { name: 'Outros', icon: <FiBox size={12} /> };
}

function getElementLabel(el, maxTextLen = 20) {
  if (!el) return 'Item';
  if (el.type === 'text') {
    const t = String(el.content || '').trim();
    return t ? (t.length > maxTextLen ? `${t.slice(0, maxTextLen)}…` : t) : 'Texto';
  }
  if (el.type === 'image') return 'Imagem';
  if (el.type === 'video') return 'Video';
  if (el.type === 'shape') return 'Forma';
  if (el.type === 'audio') return 'Audio';
  return String(el.type || 'Item');
}

function getImagePreview(el) {
  if (!el || el.type !== 'image') return null;
  const src = String(el?.content || '').trim();
  if (!src) return null;
  return {
    url: src,
    storage: el?.storage ?? el?.props?.storage ?? null,
  };
}
/** Compat: mantido para usos internos que já existem */
function getImagePreviewUrl(el) {
  return getImagePreview(el)?.url || '';
}

function normalizeTimelineElement(raw, idx) {
  if (!raw || typeof raw !== 'object') {
    return {
      id: `el-${idx}`,
      type: 'shape',
      content: '',
      step: 0,
      zIndex: idx + 1,
    };
  }
  if (raw?.props && typeof raw.props === 'object') {
    return {
      id: String(raw?.id || `el-${idx}`),
      type: String(raw?.type || 'shape'),
      content: raw?.props?.content ?? '',
      step: Number.isFinite(Number(raw?.step)) ? Number(raw.step) : 0,
      zIndex: Number.isFinite(Number(raw?.zIndex)) ? Number(raw.zIndex) : idx + 1,
    };
  }
  return {
    id: String(raw?.id || `el-${idx}`),
    type: String(raw?.type || 'shape'),
    content: raw?.content ?? '',
    step: Number.isFinite(Number(raw?.step)) ? Number(raw.step) : 0,
    zIndex: Number.isFinite(Number(raw?.zIndex)) ? Number(raw.zIndex) : idx + 1,
  };
}

/** Largura de coluna e densidade da UI conforme viewport (timeline em telas pequenas). */
function useTimelineLayout() {
  const [layout, setLayout] = useState(() => ({
    stepWidth: 80,
    sidebarWidthPx: 200,
    rowHeight: 52,
    compactHeader: false,
  }));

  useEffect(() => {
    const update = () => {
      const w = typeof window !== 'undefined' ? window.innerWidth : 1024;
      let stepWidth = 80;
      let sidebarWidthPx = 200;
      let rowHeight = 52;
      let compactHeader = false;
      if (w < 380) {
        stepWidth = 40;
        sidebarWidthPx = 88;
        rowHeight = 44;
        compactHeader = true;
      } else if (w < 480) {
        stepWidth = 44;
        sidebarWidthPx = 100;
        rowHeight = 46;
        compactHeader = true;
      } else if (w < 640) {
        stepWidth = 52;
        sidebarWidthPx = 120;
        rowHeight = 48;
        compactHeader = true;
      } else if (w < 900) {
        stepWidth = 64;
        sidebarWidthPx = 160;
        rowHeight = 50;
      }
      setLayout({ stepWidth, sidebarWidthPx, rowHeight, compactHeader });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return layout;
}

export default function ProTimeline({
  currentStep,
  onStepChange,
  isPlaying,
  onPlayPause,
  onStepBack,
  onStepForward,
  nodes,
  elements, // compat legada temporária
  onElementSelect,
  selectedElement,
  onUpdateElementStep,
}) {
  const source = Array.isArray(nodes) ? nodes : Array.isArray(elements) ? elements : [];
  const safeElements = source.map((el, idx) => normalizeTimelineElement(el, idx));
  const gridHorizontalScrollRef = useRef(null);
  const stepHeaderScrollRef = useRef(null);
  const [draggingId, setDraggingId] = useState(null);
  const {
    stepWidth: STEP_WIDTH,
    sidebarWidthPx,
    rowHeight: ROW_HEIGHT_BASE,
    compactHeader,
  } = useTimelineLayout();

  const { maxSteps, rows } = useMemo(() => {
    const stepsUsed = safeElements.map((e) =>
      Number.isFinite(Number(e?.step)) ? Number(e.step) : 0,
    );
    const m = stepsUsed.length ? Math.max(0, ...stepsUsed) : 0;
    /** Sempre mostrar varias colunas (0..N); antes, com tudo na etapa 0, surgia so "00/00" e parecia nao haver etapas. */
    const max = Math.min(MAX_TIMELINE_STEP, Math.max(m, MIN_VISIBLE_TIMELINE_STEPS));
    const grouped = {};
    for (const el of safeElements) {
      const { name, icon } = getTrackInfo(el);
      if (!grouped[name]) grouped[name] = { icon, items: [] };
      grouped[name].items.push(el);
    }
    const order = ['Audio (Cena)', 'Textos', 'Imagens', 'Videos', 'Interacoes', 'Outros'];
    const entries = Object.entries(grouped).sort((a, b) => {
      const ia = order.indexOf(a[0]);
      const ib = order.indexOf(b[0]);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });

    const preparedRows = entries.flatMap(([trackName, data]) => {
      const itemsOrdered = [...(data.items || [])].sort(
        (a, b) => Number(a?.zIndex || 0) - Number(b?.zIndex || 0),
      );
      if (itemsOrdered.length === 0) return [];
      return itemsOrdered.map((item, idx) => ({
        rowId: `${trackName}-${String(item?.id || idx)}`,
        trackName: idx === 0 ? trackName : `${trackName} ${idx + 1}`,
        icon: data.icon,
        item,
        rowHeight: ROW_HEIGHT_BASE,
      }));
    });

    return { maxSteps: max, rows: preparedRows };
  }, [safeElements, ROW_HEIGHT_BASE]);

  const steps = Array.from({ length: maxSteps + 1 }).map((_, i) => i);

  useEffect(() => {
    if (isPlaying && gridHorizontalScrollRef.current) {
      const scrollPos = currentStep * STEP_WIDTH;
      const offset = Math.min(200, Math.max(80, window.innerWidth * 0.25));
      const el = gridHorizontalScrollRef.current;
      el.scrollLeft = Math.max(0, scrollPos - offset);
      if (stepHeaderScrollRef.current) stepHeaderScrollRef.current.scrollLeft = el.scrollLeft;
    }
  }, [currentStep, isPlaying, STEP_WIDTH]);

  /** Grelha (etapas) e cabeçalho numérico partilham o mesmo scroll horizontal */
  const syncHeaderScrollFromGrid = useCallback((e) => {
    const left = e.target.scrollLeft;
    if (stepHeaderScrollRef.current) stepHeaderScrollRef.current.scrollLeft = left;
  }, []);

  const syncGridScrollFromHeader = useCallback((e) => {
    const left = e.target.scrollLeft;
    if (gridHorizontalScrollRef.current) gridHorizontalScrollRef.current.scrollLeft = left;
  }, []);

  const handleDragStart = (e, id) => {
    setDraggingId(id);
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => {
      if (e.target) e.target.style.opacity = '0.4';
    }, 0);
  };

  const handleDragEnd = (e) => {
    setDraggingId(null);
    if (e.target) e.target.style.opacity = '1';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, newStep) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    if (id && onUpdateElementStep && newStep !== undefined) {
      onUpdateElementStep(id, newStep);
    }
    setDraggingId(null);
  };

  const blockPad = Math.max(2, Math.min(6, Math.round(STEP_WIDTH * 0.08)));

  return (
    <div className="flex h-full w-full min-w-0 select-none flex-col bg-slate-900 font-sans text-slate-300">
      <div className="flex shrink-0 flex-col gap-2 border-b border-slate-700 bg-slate-900 px-2 py-2 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex shrink-0 items-center rounded-md border border-slate-700 bg-slate-800 p-0.5">
            <button
              onClick={onStepBack}
              className="min-h-[40px] min-w-[40px] rounded p-2 transition-colors hover:bg-slate-700 hover:text-white sm:min-h-0 sm:min-w-0 sm:p-1.5"
              title="Voltar 1 etapa"
              type="button"
            >
              <FiSkipBack size={14} />
            </button>
            <button
              onClick={onPlayPause}
              className="mx-0.5 flex min-h-[40px] min-w-[40px] justify-center rounded bg-indigo-600 p-2 text-white shadow-sm transition-colors hover:bg-indigo-500 sm:min-h-0 sm:min-w-[32px] sm:p-1.5"
              title={isPlaying ? 'Pausar' : 'Reproduzir'}
              type="button"
            >
              {isPlaying ? <FiPause size={14} /> : <FiPlay size={14} />}
            </button>
            <button
              onClick={onStepForward}
              className="min-h-[40px] min-w-[40px] rounded p-2 transition-colors hover:bg-slate-700 hover:text-white sm:min-h-0 sm:min-w-0 sm:p-1.5"
              title="Avancar 1 etapa"
              type="button"
            >
              <FiSkipForward size={14} />
            </button>
          </div>
          <div className="min-w-0 flex-1 rounded border border-slate-800 bg-slate-950 px-2 py-1 font-mono text-xs shadow-inner sm:px-3">
            <div className="flex flex-wrap items-baseline gap-1">
              <span className={`text-slate-500 ${compactHeader ? 'text-[10px]' : ''}`}>Etapa</span>
              <span className="text-sm font-bold text-indigo-400">{String(currentStep).padStart(2, '0')}</span>
              <span className="text-slate-600">/</span>
              <span className="text-slate-400" title="Ultimo indice de etapa na grelha">
                {String(maxSteps).padStart(2, '0')}
              </span>
            </div>
            {!compactHeader ? (
              <span className="mt-0.5 block text-[9px] font-sans font-normal normal-case tracking-normal text-slate-500">
                Clique nos numeros na grelha para mudar a etapa de preview
              </span>
            ) : (
              <span className="mt-0.5 block text-[9px] text-slate-500">Toque na grelha para mudar a etapa</span>
            )}
          </div>
        </div>
        <div
          className={`hidden text-slate-500 sm:block ${compactHeader ? 'max-w-[200px] text-[9px]' : 'max-w-[280px] text-[10px]'} text-right font-semibold uppercase leading-tight tracking-wider`}
          title="Arraste cada bloco para a coluna em que o elemento deve aparecer"
        >
          <span>Etapas: arraste cada bloco para a coluna em que o elemento deve aparecer</span>
        </div>
        <p className="text-[9px] leading-snug text-slate-500 sm:hidden">
          Arraste os blocos para mudar a etapa de entrada. Deslize a grelha para ver mais colunas.
        </p>
      </div>
      {/* Uma única scroll vertical para trilhas + grelha; cabeçalhos com mesma altura (h-8) para alinhar linhas */}
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 border-b border-slate-700 bg-slate-900">
          <div
            className="z-20 flex h-8 shrink-0 items-center border-r border-slate-700 bg-slate-900 px-2 text-[9px] font-bold uppercase tracking-wider text-slate-500 shadow-[2px_0_10px_rgba(0,0,0,0.2)] sm:px-3 sm:text-[10px]"
            style={{ width: sidebarWidthPx, minWidth: sidebarWidthPx, maxWidth: sidebarWidthPx }}
          >
            <span className="truncate">Trilhas ({safeElements.length})</span>
          </div>
          <div
            ref={stepHeaderScrollRef}
            onScroll={syncGridScrollFromHeader}
            className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden [-webkit-overflow-scrolling:touch]"
          >
            <div className="flex h-8 min-w-max border-slate-800">
              {steps.map((s) => (
                <div
                  key={s}
                  onClick={() => onStepChange(s)}
                  title={`Etapa ${s}: clique para ver o canvas nesta etapa`}
                  className={`relative flex min-w-0 flex-shrink-0 cursor-pointer flex-col justify-end border-l border-slate-800 transition-colors hover:bg-slate-800 ${s === currentStep ? 'bg-indigo-900/30' : ''}`}
                  style={{ width: `${STEP_WIDTH}px`, minWidth: `${STEP_WIDTH}px` }}
                >
                  <span
                    className={`pb-0.5 pl-1 sm:pl-1.5 ${compactHeader ? 'text-[9px]' : 'text-[10px]'} ${s === currentStep ? 'font-bold text-indigo-400' : 'text-slate-500'}`}
                  >
                    {s}
                  </span>
                  <div className="absolute bottom-0 flex w-full justify-between px-1 opacity-30">
                    <div className="h-1 w-[1px] bg-slate-400" />
                    <div className="h-1.5 w-[1px] bg-slate-400" />
                    <div className="h-1 w-[1px] bg-slate-400" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden [-webkit-overflow-scrolling:touch]">
          {rows.length === 0 ? (
            <div className="border-b border-slate-800 bg-slate-950 p-4 text-xs text-slate-500">
              Nenhum elemento no canvas.
            </div>
          ) : (
            <div
              className="grid w-full min-w-0"
              style={{
                gridTemplateColumns: `${sidebarWidthPx}px minmax(0, 1fr)`,
                gridTemplateRows: rows.map((r) => `${r.rowHeight}px`).join(' '),
              }}
            >
              {rows.map((row, index) => (
                <div
                  key={`side-${row.rowId}`}
                  className="box-border flex min-h-0 min-w-0 items-center border-b border-r border-slate-700 bg-slate-900 px-1.5 shadow-[2px_0_10px_rgba(0,0,0,0.2)] transition-colors hover:bg-slate-800 sm:px-3"
                  style={{ gridColumn: 1, gridRow: index + 1 }}
                >
                  <div className="flex min-h-0 w-full min-w-0 items-center gap-1.5 sm:gap-2">
                    <span className="flex shrink-0 items-center text-indigo-400">{row.icon}</span>
                    <span
                      className={`min-w-0 truncate font-medium leading-none text-slate-300 ${compactHeader ? 'text-[10px]' : 'text-xs'}`}
                      title={row.trackName}
                    >
                      {row.trackName}
                    </span>
                  </div>
                </div>
              ))}
              <div
                className="relative flex min-h-0 w-full min-w-0 flex-col border-b border-slate-800 bg-slate-950"
                style={{ gridColumn: 2, gridRow: '1 / -1' }}
              >
                <div
                  ref={gridHorizontalScrollRef}
                  onScroll={syncHeaderScrollFromGrid}
                  className="box-border h-full min-h-0 w-full flex-1 overflow-x-auto overflow-y-hidden [-webkit-overflow-scrolling:touch]"
                >
                  <div className="relative min-w-max pb-20">
                    <div
                      className="pointer-events-none absolute top-0 bottom-0 z-[15] w-px bg-indigo-500 transition-all duration-200 ease-linear"
                      style={{ left: `${currentStep * STEP_WIDTH + 1}px` }}
                    >
                      <div className="absolute top-0 h-0 w-0 -translate-x-1/2 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent border-t-indigo-500" />
                    </div>
                    {rows.map((r) => (
                      <div
                        key={r.rowId}
                        className="relative box-border border-b border-slate-800"
                        style={{ height: r.rowHeight, minHeight: r.rowHeight }}
                      >
                        {steps.map((s) => (
                          <div
                            key={s}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, s)}
                            className={`h-full flex-shrink-0 border-l border-slate-800/40 transition-colors ${draggingId ? 'hover:bg-indigo-500/10' : ''}`}
                            style={{ width: `${STEP_WIDTH}px`, minWidth: `${STEP_WIDTH}px` }}
                          />
                        ))}
                        {(() => {
                          const el = r.item;
                          const step = clampInt(el?.step ?? 0, 0, maxSteps);
                          const isSelected =
                            selectedElement && String(el?.id) === String(selectedElement);
                          const isDragging = draggingId === el.id;
                          const imagePreview = getImagePreview(el);
                          const blockH = Math.min(32, Math.max(22, r.rowHeight - 8));
                          const blockTopPx = Math.max(4, Math.round((r.rowHeight - blockH) / 2));
                          return (
                            <div
                              key={el.id}
                              draggable
                              onDragStart={(e) => handleDragStart(e, el.id)}
                              onDragEnd={handleDragEnd}
                              onClick={(e) => {
                                e.stopPropagation();
                                onElementSelect(String(el.id));
                              }}
                              className="absolute flex cursor-grab items-center overflow-hidden rounded-md border transition-all active:cursor-grabbing touch-manipulation"
                              style={{
                                left: `${step * STEP_WIDTH + blockPad}px`,
                                top: `${blockTopPx}px`,
                                height: `${blockH}px`,
                                width: `${Math.max(28, STEP_WIDTH - blockPad * 2)}px`,
                                zIndex: isDragging ? 50 : isSelected ? 10 : 1,
                                backgroundColor: isSelected ? '#4f46e5' : '#334155',
                                borderColor: isSelected ? '#818cf8' : '#475569',
                              }}
                              title={`Arrastar para mudar a entrada. Atual: Etapa ${step}`}
                            >
                              <div className="pointer-events-none absolute top-0 bottom-0 right-[-100px] w-[100px] bg-gradient-to-r from-slate-500 to-transparent opacity-20" />
                              <div
                                className={`relative z-10 flex flex-1 items-center gap-1 truncate px-1.5 font-medium text-white sm:gap-1.5 sm:px-2 ${compactHeader ? 'text-[10px]' : 'text-[11px]'}`}
                              >
                                {imagePreview ? (
                                  <StorageBackedHtmlImage
                                    src={imagePreview.url}
                                    storage={imagePreview.storage}
                                    alt=""
                                    className={`shrink-0 rounded object-cover ${compactHeader ? 'h-4 w-4' : 'h-5 w-5'}`}
                                    draggable={false}
                                  />
                                ) : null}
                                <div
                                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${isSelected ? 'bg-white' : 'bg-slate-400'}`}
                                />
                                <span className="truncate">
                                  {getElementLabel(el, compactHeader ? 12 : 20)}
                                </span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

