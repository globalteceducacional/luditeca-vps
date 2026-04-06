import React, { useMemo } from 'react';
import { FiCrop, FiSliders } from 'react-icons/fi';

const CROP_PRESETS = [
  { label: 'Original', rect: { x: 0, y: 0, width: 100, height: 100 } },
  { label: 'Retrato', rect: { x: 12.5, y: 0, width: 75, height: 100 } },
  { label: 'Paisagem', rect: { x: 0, y: 12.5, width: 100, height: 75 } },
  { label: 'Quadrado', rect: { x: 12.5, y: 12.5, width: 75, height: 75 } },
];

function SliderRow({ label, value, min, max, step, onChange }) {
  const pct = ((Number(value) - Number(min)) / (Number(max) - Number(min))) * 100;
  return (
    <div className="grid grid-cols-[120px_1fr_40px] items-center gap-3">
      <span className="text-xs text-slate-400">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onChange}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-700 accent-indigo-500"
      />
      <span className="text-right text-xs font-mono text-slate-300">{Number(value).toFixed(2)}</span>
    </div>
  );
}

export default function ImageEditorPanel({
  editorImageError,
  cropRect,
  setCropRect,
  normalizeCropRect,
  imageAdjustments,
  normalizeImageAdjustments,
  setImageAdjustments,
  editorBusy,
  onApplyAdjustments,
  editorImageMeta,
  cropPreviewCanvasRef,
  onApplyCrop,
}) {
  const adj = useMemo(() => normalizeImageAdjustments(imageAdjustments), [imageAdjustments, normalizeImageAdjustments]);

  return (
    <div className="space-y-0 divide-y divide-slate-800">
      <div className="px-5 py-4">
        <div className="mb-3 flex items-center gap-2">
          <FiSliders size={13} className="text-indigo-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Ajustes visuais</h3>
        </div>
        <div className="space-y-3 rounded-xl border border-slate-700/60 bg-slate-900/50 p-4">
          <SliderRow
            label={`Brilho`}
            value={adj.brightness}
            min="0.2"
            max="3"
            step="0.05"
            onChange={(e) => setImageAdjustments((prev) => ({ ...prev, brightness: Number(e.target.value) }))}
          />
          <SliderRow
            label="Contraste"
            value={adj.contrast}
            min="0.2"
            max="3"
            step="0.05"
            onChange={(e) => setImageAdjustments((prev) => ({ ...prev, contrast: Number(e.target.value) }))}
          />
          <SliderRow
            label="Saturação"
            value={adj.saturation}
            min="0"
            max="3"
            step="0.05"
            onChange={(e) => setImageAdjustments((prev) => ({ ...prev, saturation: Number(e.target.value) }))}
          />
          <SliderRow
            label={`Rotação (${Math.round(adj.rotation)}°)`}
            value={adj.rotation}
            min="-180"
            max="180"
            step="1"
            onChange={(e) => setImageAdjustments((prev) => ({ ...prev, rotation: Number(e.target.value) }))}
          />

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-700"
              onClick={() => setImageAdjustments(normalizeImageAdjustments({}))}
            >
              Resetar
            </button>
            <button
              type="button"
              disabled={editorBusy === 'adjust'}
              className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={onApplyAdjustments}
            >
              {editorBusy === 'adjust' ? 'Aplicando…' : 'Aplicar à imagem'}
            </button>
          </div>
          <p className="text-[10px] leading-relaxed text-slate-600">
            Aplicar sobrescreve a imagem na biblioteca. Esta ação não pode ser desfeita.
          </p>
        </div>
      </div>

      <div className="px-5 py-4">
        <div className="mb-3 flex items-center gap-2">
          <FiCrop size={13} className="text-indigo-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Recorte</h3>
        </div>

        {editorImageError ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
            {editorImageError}
          </div>
        ) : (
          <div className="flex gap-4">
            <div className="flex-1 space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {CROP_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-indigo-500 hover:bg-indigo-500/10 hover:text-indigo-300"
                    onClick={() => setCropRect(preset.rect)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'x', label: 'X %', min: 0, max: 99 },
                  { key: 'y', label: 'Y %', min: 0, max: 99 },
                  { key: 'width', label: 'Largura %', min: 1, max: 100 },
                  { key: 'height', label: 'Altura %', min: 1, max: 100 },
                ].map(({ key, label, min, max }) => (
                  <label key={key} className="flex flex-col gap-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>
                    <input
                      type="number"
                      min={min}
                      max={max}
                      value={cropRect[key]}
                      onChange={(e) =>
                        setCropRect((prev) => normalizeCropRect({ ...prev, [key]: e.target.value }))
                      }
                      className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                    />
                  </label>
                ))}
              </div>

              <p className="text-[10px] leading-relaxed text-slate-600">
                {editorImageMeta.width > 0
                  ? `Original: ${editorImageMeta.width} × ${editorImageMeta.height}px.`
                  : ''}{' '}
                Aplicar recorte sobrescreve o ficheiro na biblioteca.
              </p>
            </div>

            <div className="w-40 shrink-0">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Prévia</p>
              <div className="overflow-hidden rounded-lg border border-slate-700 bg-slate-950">
                <canvas ref={cropPreviewCanvasRef} className="h-auto w-full" />
              </div>
              <button
                type="button"
                disabled={editorBusy === 'crop'}
                className="mt-2 w-full rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={onApplyCrop}
              >
                {editorBusy === 'crop' ? 'Aplicando…' : 'Aplicar recorte'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
