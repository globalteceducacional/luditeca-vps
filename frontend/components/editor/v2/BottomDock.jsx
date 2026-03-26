import React from 'react';
import { FiFilm } from 'react-icons/fi';
import ProTimeline from '../ProTimeline';

function toLegacyElements(nodes = []) {
  return nodes.map((n, idx) => {
    const t = n?.transform || {};
    const p = n?.props || {};
    return {
      id: String(n?.id || `el-${idx}`),
      type: String(n?.type || 'shape'),
      content: p?.content ?? '',
      step: Number.isFinite(Number(n?.step)) ? Number(n.step) : 0,
      zIndex: Number.isFinite(Number(n?.zIndex)) ? Number(n.zIndex) : idx + 1,
      position: { x: Number(t.x || 0), y: Number(t.y || 0) },
      size: { width: Number(t.width || 120), height: Number(t.height || 80) },
    };
  });
}

export default function BottomDock({
  pageNodes = [],
  selectedNodeId,
  onSelectNode,
  currentStep,
  onStepChange,
  isPlaying,
  onPlayPause,
  onStepBack,
  onStepForward,
  onUpdateElementStep,
}) {
  const legacyElements = toLegacyElements(pageNodes);
  const tabBaseClass =
    'flex items-center gap-2 px-4 py-2 text-xs font-medium border-t-2 transition-colors cursor-pointer';
  const activeTabClass = `${tabBaseClass} border-indigo-500 bg-slate-800 text-indigo-400`;
  const inactiveTabClass = `${tabBaseClass} border-transparent bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200`;

  return (
    <div className="flex h-full flex-col bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-700 bg-slate-900 pr-3">
        <div className="flex items-center">
          <div className={activeTabClass}>
            <FiFilm size={14} />
            Timeline
          </div>
        </div>
        <div />
      </div>

      <div className="min-h-0 flex-1 overflow-hidden bg-slate-900">
        <ProTimeline
          currentStep={currentStep}
          onStepChange={onStepChange}
          isPlaying={isPlaying}
          onPlayPause={onPlayPause}
          onStepBack={onStepBack}
          onStepForward={onStepForward}
          elements={legacyElements}
          onElementSelect={onSelectNode}
          selectedElement={selectedNodeId}
          onUpdateElementStep={onUpdateElementStep}
        />
      </div>
    </div>
  );
}
