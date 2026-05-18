import React from 'react';

/** Placeholder enquanto um painel pesado (Next/dynamic) carrega no cliente. */
export default function PanelSkeleton() {
  return (
    <div
      className="flex min-h-0 flex-1 animate-pulse flex-col gap-3 p-4"
      role="status"
      aria-label="A carregar painel"
    >
      <div className="h-3 w-2/3 rounded bg-slate-700" />
      <div className="h-3 w-1/2 rounded bg-slate-700/80" />
      <div className="min-h-0 flex-1 rounded-md bg-slate-700/50" />
    </div>
  );
}
