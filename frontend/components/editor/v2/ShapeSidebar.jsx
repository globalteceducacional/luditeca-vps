import React from 'react';

const SHAPE_ITEMS = [
  {
    id: 'rectangle',
    label: 'Retangulo',
    icon: <rect x="3" y="6" width="18" height="12" rx="2" strokeWidth="2" stroke="currentColor" fill="none" />,
  },
  {
    id: 'circle',
    label: 'Circulo',
    icon: <circle cx="12" cy="12" r="8" strokeWidth="2" stroke="currentColor" fill="none" />,
  },
  {
    id: 'triangle',
    label: 'Triangulo',
    icon: <polygon points="12,4 4,20 20,20" strokeWidth="2" stroke="currentColor" fill="none" strokeLinejoin="round" />,
  },
  {
    id: 'star',
    label: 'Estrela',
    icon: <polygon points="12,2 15,9 22,9 17,14 19,21 12,17 5,21 7,14 2,9 9,9" strokeWidth="2" stroke="currentColor" fill="none" strokeLinejoin="round" />,
  },
  {
    id: 'arrow',
    label: 'Seta',
    icon: <path d="M4,12 L20,12 M14,6 L20,12 L14,18" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
  },
  {
    id: 'diamond',
    label: 'Losango',
    icon: <polygon points="12,3 20,12 12,21 4,12" strokeWidth="2" stroke="currentColor" fill="none" strokeLinejoin="round" />,
  },
  {
    id: 'hexagon',
    label: 'Hexagono',
    icon: <polygon points="7,4 17,4 22,12 17,20 7,20 2,12" strokeWidth="2" stroke="currentColor" fill="none" strokeLinejoin="round" />,
  },
  {
    id: 'line',
    label: 'Linha',
    icon: <path d="M4 12 L20 12" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" />,
  },
];

export default function ShapeSidebar({ onAddShape }) {
  return (
    <div className="flex h-full flex-col bg-slate-800 text-slate-200">
      <div className="border-b border-slate-700 bg-slate-900 px-3 py-2">
        <div className="text-xs font-semibold text-slate-200">Adicionar formas</div>
      </div>
      <div className="grid grid-cols-2 gap-3 p-4">
        {SHAPE_ITEMS.map((shape) => (
          <button
            key={shape.id}
            type="button"
            onClick={() => onAddShape(shape.id)}
            className="group flex flex-col items-center justify-center rounded-lg border border-slate-700 bg-slate-900 py-3 transition-all hover:border-indigo-500 hover:bg-slate-800"
          >
            <svg className="mb-2 h-6 w-6 text-slate-400 group-hover:text-indigo-400" viewBox="0 0 24 24">
              {shape.icon}
            </svg>
            <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500 group-hover:text-slate-200">
              {shape.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
