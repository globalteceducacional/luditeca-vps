import React, { useMemo } from 'react';

function range(from, to, step) {
  const out = [];
  for (let v = from; v <= to; v += step) out.push(v);
  return out;
}

/**
 * Réguas simples (topo + esquerda) para dar “cara” de ferramenta pro.
 * Não depende do zoom do canvas (protótipo visual). Evoluímos depois para casar com o scale real.
 */
export default function RulersOverlay({ visible = true }) {
  const ticksX = useMemo(() => range(0, 1280, 80), []);
  const ticksY = useMemo(() => range(0, 720, 60), []);

  if (!visible) return null;

  return (
    <div className="pointer-events-none absolute inset-0">
      {/* top ruler */}
      <div className="absolute left-8 right-0 top-0 h-8 border-b border-gray-800 bg-gray-950/70 backdrop-blur">
        <div className="relative h-full">
          {ticksX.map((x) => (
            <div key={x} className="absolute top-0 h-full" style={{ left: `${(x / 1280) * 100}%` }}>
              <div className="h-2 w-px bg-gray-500/70" />
              <div className="mt-1 text-[10px] text-gray-400">{x}</div>
            </div>
          ))}
        </div>
      </div>

      {/* left ruler */}
      <div className="absolute bottom-0 left-0 top-8 w-8 border-r border-gray-800 bg-gray-950/70 backdrop-blur">
        <div className="relative h-full">
          {ticksY.map((y) => (
            <div key={y} className="absolute left-0 w-full" style={{ top: `${(y / 720) * 100}%` }}>
              <div className="ml-auto h-px w-2 bg-gray-500/70" />
              <div className="mt-0.5 rotate-[-90deg] origin-left text-[10px] text-gray-400">
                {y}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* corner */}
      <div className="absolute left-0 top-0 h-8 w-8 border-b border-r border-gray-800 bg-gray-950/80" />
    </div>
  );
}

