import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FiBox,
  FiImage,
  FiMousePointer,
  FiPause,
  FiPlay,
  FiSkipBack,
  FiSkipForward,
  FiType,
  FiVolume2,
} from 'react-icons/fi';

function clampInt(n, min, max) {
  const v = Number.isFinite(Number(n)) ? Math.trunc(Number(n)) : 0;
  return Math.max(min, Math.min(max, v));
}

function getTrackInfo(el) {
  if (!el) return { name: 'Outros', icon: <FiBox size={12} /> };
  if (el.type === 'audio') return { name: 'Audio (Cena)', icon: <FiVolume2 size={12} /> };
  if (el.type === 'text') return { name: 'Textos', icon: <FiType size={12} /> };
  if (el.type === 'image') return { name: 'Imagens', icon: <FiImage size={12} /> };
  if (el.type === 'shape') return { name: 'Interacoes', icon: <FiMousePointer size={12} /> };
  return { name: 'Outros', icon: <FiBox size={12} /> };
}

function getElementLabel(el) {
  if (!el) return 'Item';
  if (el.type === 'text') {
    const t = String(el.content || '').trim();
    return t ? (t.length > 20 ? `${t.slice(0, 20)}…` : t) : 'Texto';
  }
  if (el.type === 'image') return 'Imagem';
  if (el.type === 'shape') return 'Forma';
  if (el.type === 'audio') return 'Audio';
  return String(el.type || 'Item');
}

function getImagePreviewUrl(el) {
  if (!el || el.type !== 'image') return '';
  const src = String(el?.content || '').trim();
  return src || '';
}

export default function ProTimeline({
  currentStep,
  onStepChange,
  isPlaying,
  onPlayPause,
  onStepBack,
  onStepForward,
  elements,
  onElementSelect,
  selectedElement,
  onUpdateElementStep,
}) {
  const safeElements = Array.isArray(elements) ? elements : [];
  const timelineRef = useRef(null);
  const [draggingId, setDraggingId] = useState(null);

  const { maxSteps, tracks } = useMemo(() => {
    const stepsUsed = safeElements.map((e) =>
      Number.isFinite(Number(e?.step)) ? Number(e.step) : 0,
    );
    const m = stepsUsed.length ? Math.max(0, ...stepsUsed) : 0;
    /** Sempre mostrar varias colunas (0..N); antes, com tudo na etapa 0, surgia so "00/00" e parecia nao haver etapas. */
    const max = Math.min(20, Math.max(m, 5));
    const grouped = {};
    for (const el of safeElements) {
      const { name, icon } = getTrackInfo(el);
      if (!grouped[name]) grouped[name] = { icon, items: [] };
      grouped[name].items.push(el);
    }
    const order = ['Audio (Cena)', 'Textos', 'Imagens', 'Interacoes', 'Outros'];
    const entries = Object.entries(grouped).sort((a, b) => {
      const ia = order.indexOf(a[0]);
      const ib = order.indexOf(b[0]);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });

    const preparedTracks = entries.map(([trackName, data]) => {
      const byStep = new Map();
      const itemsOrdered = [...(data.items || [])].sort(
        (a, b) => Number(a?.zIndex || 0) - Number(b?.zIndex || 0),
      );

      for (const el of itemsOrdered) {
        const step = clampInt(el?.step ?? 0, 0, max);
        if (!byStep.has(step)) byStep.set(step, []);
        byStep.get(step).push(el);
      }

      const indexById = new Map();
      let maxStack = 1;
      for (const [, stack] of byStep) {
        maxStack = Math.max(maxStack, stack.length);
        stack.forEach((el, idx) => {
          indexById.set(String(el.id), idx);
        });
      }

      const rowHeight = Math.max(52, maxStack * 34 + 10);

      return {
        trackName,
        icon: data.icon,
        items: itemsOrdered,
        rowHeight,
        indexById,
      };
    });

    return { maxSteps: max, tracks: preparedTracks };
  }, [safeElements]);

  const steps = Array.from({ length: maxSteps + 1 }).map((_, i) => i);
  const STEP_WIDTH = 80;

  useEffect(() => {
    if (isPlaying && timelineRef.current) {
      const scrollPos = currentStep * STEP_WIDTH;
      timelineRef.current.scrollLeft = Math.max(0, scrollPos - 200);
    }
  }, [currentStep, isPlaying]);

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

  return (
    <div className="flex h-full w-full select-none flex-col bg-slate-900 font-sans text-slate-300">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-700 bg-slate-900 px-3 py-2 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-md border border-slate-700 bg-slate-800 p-0.5">
            <button onClick={onStepBack} className="rounded p-1.5 transition-colors hover:bg-slate-700 hover:text-white" title="Voltar 1 etapa" type="button">
              <FiSkipBack size={14} />
            </button>
            <button onClick={onPlayPause} className="mx-0.5 flex w-8 justify-center rounded bg-indigo-600 p-1.5 text-white shadow-sm transition-colors hover:bg-indigo-500" title={isPlaying ? 'Pausar' : 'Reproduzir'} type="button">
              {isPlaying ? <FiPause size={14} /> : <FiPlay size={14} />}
            </button>
            <button onClick={onStepForward} className="rounded p-1.5 transition-colors hover:bg-slate-700 hover:text-white" title="Avancar 1 etapa" type="button">
              <FiSkipForward size={14} />
            </button>
          </div>
          <div className="flex flex-col gap-0.5 rounded border border-slate-800 bg-slate-950 px-3 py-1 font-mono text-xs shadow-inner">
            <div className="flex items-baseline gap-1">
              <span className="text-slate-500">Etapa atual</span>
              <span className="text-sm font-bold text-indigo-400">{String(currentStep).padStart(2, '0')}</span>
              <span className="text-slate-600">/</span>
              <span className="text-slate-400" title="Ultimo indice de etapa na grelha">
                {String(maxSteps).padStart(2, '0')}
              </span>
            </div>
            <span className="text-[9px] font-sans font-normal normal-case tracking-normal text-slate-500">
              Clique nos numeros na grelha para mudar a etapa de preview
            </span>
          </div>
        </div>
        <div className="max-w-[280px] text-right text-[10px] font-semibold uppercase leading-tight tracking-wider text-slate-500">
          <span>Etapas: arraste cada bloco para a coluna em que o elemento deve aparecer</span>
        </div>
      </div>
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <div className="z-20 flex w-[200px] shrink-0 flex-col border-r border-slate-700 bg-slate-900 shadow-[2px_0_10px_rgba(0,0,0,0.2)]">
          <div className="flex h-8 items-center border-b border-slate-700 bg-slate-900 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Trilhas ({safeElements.length})
          </div>
          <div className="flex-1 overflow-y-auto">
            {tracks.map((track) => (
              <div
                key={track.trackName}
                className="flex items-center justify-between border-b border-slate-800 px-3 transition-colors hover:bg-slate-800"
                style={{ height: `${track.rowHeight}px` }}
              >
                <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
                  <span className="text-indigo-400">{track.icon}</span>
                  {track.trackName}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div ref={timelineRef} className="relative flex-1 overflow-auto bg-slate-950">
          <div className="sticky top-0 z-10 flex h-8 min-w-max border-b border-slate-700 bg-slate-900">
            {steps.map((s) => (
              <div
                key={s}
                onClick={() => onStepChange(s)}
                title={`Etapa ${s}: clique para ver o canvas nesta etapa`}
                className={`relative flex flex-shrink-0 cursor-pointer flex-col justify-end border-l border-slate-800 transition-colors hover:bg-slate-800 ${s === currentStep ? 'bg-indigo-900/30' : ''}`}
                style={{ width: `${STEP_WIDTH}px` }}
              >
                <span className={`pl-1.5 pb-0.5 text-[10px] ${s === currentStep ? 'font-bold text-indigo-400' : 'text-slate-500'}`}>
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
          <div
            className="pointer-events-none absolute top-0 bottom-0 z-[15] w-px bg-indigo-500 transition-all duration-200 ease-linear"
            style={{ left: `${currentStep * STEP_WIDTH + 1}px` }}
          >
            <div className="absolute top-0 h-0 w-0 -translate-x-1/2 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent border-t-indigo-500" />
          </div>
          <div className="min-w-max pb-20">
            {tracks.length === 0 ? (
              <div className="p-4 text-xs text-slate-500">Nenhum elemento no canvas.</div>
            ) : (
              tracks.map((track) => (
                <div
                  key={track.trackName}
                  className="relative flex border-b border-slate-800"
                  style={{ height: `${track.rowHeight}px` }}
                >
                  {steps.map((s) => (
                    <div
                      key={s}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, s)}
                      className={`h-full flex-shrink-0 border-l border-slate-800/40 transition-colors ${draggingId ? 'hover:bg-indigo-500/10' : ''}`}
                      style={{ width: `${STEP_WIDTH}px` }}
                    />
                  ))}
                  {track.items.map((el) => {
                    const step = clampInt(el?.step ?? 0, 0, maxSteps);
                    const stackIndex = track.indexById.get(String(el?.id)) || 0;
                    const isSelected = selectedElement && String(el?.id) === String(selectedElement);
                    const isDragging = draggingId === el.id;
                    const previewUrl = getImagePreviewUrl(el);
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
                        className="absolute flex h-8 cursor-grab items-center overflow-hidden rounded-md border transition-all active:cursor-grabbing"
                        style={{
                          left: `${step * STEP_WIDTH + 4}px`,
                          top: `${6 + stackIndex * 32}px`,
                          width: `${STEP_WIDTH - 8}px`,
                          zIndex: isDragging ? 50 : isSelected ? 10 : 1,
                          backgroundColor: isSelected ? '#4f46e5' : '#334155',
                          borderColor: isSelected ? '#818cf8' : '#475569',
                        }}
                        title={`Arrastar para mudar a entrada. Atual: Etapa ${step}`}
                      >
                        <div className="pointer-events-none absolute top-0 bottom-0 right-[-100px] w-[100px] bg-gradient-to-r from-slate-500 to-transparent opacity-20" />
                        <div className="relative z-10 flex flex-1 items-center gap-1.5 truncate px-2 text-[11px] font-medium text-white">
                          {previewUrl ? (
                            <img
                              src={previewUrl}
                              alt=""
                              className="h-5 w-5 shrink-0 rounded object-cover"
                              draggable={false}
                            />
                          ) : null}
                          <div className={`h-1.5 w-1.5 shrink-0 rounded-full ${isSelected ? 'bg-white' : 'bg-slate-400'}`} />
                          <span className="truncate">{getElementLabel(el)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

