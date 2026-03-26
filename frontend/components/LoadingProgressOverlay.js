import React, { useEffect, useState } from 'react';

/**
 * Contador de segundos enquanto `active` for true (reinicia ao ativar).
 */
export function useElapsedSeconds(active) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!active) {
      setSeconds(0);
      return undefined;
    }
    const started = Date.now();
    const id = setInterval(() => {
      setSeconds(Math.floor((Date.now() - started) / 1000));
    }, 500);
    return () => clearInterval(id);
  }, [active]);
  return seconds;
}

/**
 * Overlay com barra de progresso (determinada ou indeterminada) + mensagem.
 */
export default function LoadingProgressOverlay({
  title = 'Carregando',
  message = '',
  mode = 'indeterminate',
  percent = 0,
  showElapsed = true,
  active = true,
  /** Esconde o aviso longo no rodapé */
  showFooterHint = true,
  /** Só barra + percentual curto (sem “Processando…” longo) */
  compact = false,
}) {
  const elapsed = useElapsedSeconds(active && showElapsed);

  if (!active) return null;

  const isDeterminate = mode === 'determinate' && typeof percent === 'number';
  const safePercent = Math.min(100, Math.max(0, percent));

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm"
      role="alertdialog"
      aria-busy="true"
      aria-live="polite"
      aria-label={title}
    >
      <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        {message ? (
          <p className="mt-2 text-sm leading-relaxed text-slate-300">{message}</p>
        ) : null}

        <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-slate-900">
          {isDeterminate ? (
            <div
              className="h-full rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)] transition-[width] duration-300 ease-out"
              style={{ width: `${safePercent}%` }}
            />
          ) : (
            <div className="relative h-full w-full overflow-hidden rounded-full">
              <div className="absolute inset-y-0 w-1/3 animate-bar-indeterminate rounded-full bg-indigo-500" />
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between text-xs font-medium text-slate-400">
          <span>
            {isDeterminate
              ? `${Math.round(safePercent)}%`
              : compact
                ? '…'
                : 'Processando…'}
          </span>
          {showElapsed ? (
            <span title="Tempo decorrido" className="font-mono tabular-nums text-slate-500">
              {elapsed}s
            </span>
          ) : null}
        </div>

        {showFooterHint ? (
          <p className="mt-4 text-center text-[11px] uppercase tracking-wide text-slate-500">
            Arquivos pesados podem demorar. Mantenha a aba aberta.
          </p>
        ) : null}
      </div>
    </div>
  );
}
