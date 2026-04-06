import React from 'react';
import { FiFilm, FiImage, FiSave, FiUploadCloud, FiX } from 'react-icons/fi';

function SectionCard({ children, className = '' }) {
  return (
    <div className={`rounded-xl border border-slate-700 bg-slate-900/70 p-4 ${className}`}>
      {children}
    </div>
  );
}

function SectionTitle({ icon, children }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      {icon && <span className="text-indigo-400">{icon}</span>}
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">{children}</h3>
    </div>
  );
}

export default function MediaEditModal({
  title,
  mediaTypeLabel,
  currentName,
  previewNode,
  renameValue,
  onRenameChange,
  onRename,
  renameBusy,
  children,
  onSaveAndClose,
  onCancel,
  onChooseReplacement,
  saveDisabled,
  cancelDisabled,
  replaceDisabled,
  replaceLabel,
  fileInputRef,
  fileAccept,
  onFileChange,
  isVideo,
}) {
  const accentColor = isVideo ? 'text-violet-400' : 'text-emerald-400';
  const borderAccent = isVideo ? 'border-violet-500/30' : 'border-emerald-500/30';

  return (
    <div
      className="relative flex max-h-[min(90dvh,820px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-600 bg-slate-850 shadow-2xl"
      style={{ backgroundColor: '#0f172a' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="media-edit-title"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className={`flex shrink-0 items-center justify-between border-b ${borderAccent} px-5 py-4`}>
        <div className="flex items-center gap-3">
          <span className={`flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 ${accentColor}`}>
            {isVideo ? <FiFilm size={16} /> : <FiImage size={16} />}
          </span>
          <div>
            <h2 id="media-edit-title" className="text-sm font-bold text-slate-100">
              {title}
            </h2>
            {mediaTypeLabel && (
              <p className={`text-[10px] font-semibold uppercase tracking-wider ${accentColor}`}>
                {mediaTypeLabel}
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
          aria-label="Fechar"
          onClick={onCancel}
        >
          <FiX size={16} />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        {/* Preview */}
        <div className="border-b border-slate-800 px-5 pt-4 pb-4">
          <div className="aspect-video w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-950">
            {previewNode}
          </div>
          {currentName && (
            <p className="mt-2 truncate text-[11px] text-slate-500">{currentName}</p>
          )}
        </div>

        {/* Rename */}
        <div className="border-b border-slate-800 px-5 py-4">
          <SectionCard>
            <SectionTitle>Nome do ficheiro</SectionTitle>
            <div className="flex gap-2">
              <input
                type="text"
                value={renameValue}
                onChange={(e) => onRenameChange(e.target.value)}
                placeholder="nome_do_arquivo"
                className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
              />
              <button
                type="button"
                disabled={renameBusy}
                className="shrink-0 rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={onRename}
              >
                {renameBusy ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-slate-600">
              A extensão é mantida. Use <strong className="text-slate-400">Guardar e fechar</strong> para gravar e sair.
            </p>
          </SectionCard>
        </div>

        {/* Type-specific controls */}
        {children}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-slate-800 bg-slate-900/60 px-5 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-700 disabled:opacity-50"
            onClick={onChooseReplacement}
            disabled={replaceDisabled}
          >
            <FiUploadCloud size={13} />
            {replaceLabel}
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-700 disabled:opacity-50"
              onClick={onCancel}
              disabled={cancelDisabled}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={onSaveAndClose}
              disabled={saveDisabled}
            >
              <FiSave size={13} />
              Guardar e fechar
            </button>
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        className="sr-only"
        tabIndex={-1}
        accept={fileAccept}
        onChange={onFileChange}
      />
    </div>
  );
}
