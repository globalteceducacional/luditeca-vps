import React from 'react';
import { FiClock, FiRepeat, FiVolume2, FiVolumeX, FiZap } from 'react-icons/fi';

function SettingRow({ label, icon, children }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex w-5 shrink-0 justify-center text-slate-500">{icon}</span>
      <span className="w-24 shrink-0 text-xs text-slate-400">{label}</span>
      <div className="flex min-w-0 flex-1 items-center">{children}</div>
    </div>
  );
}

function RangeWithValue({ value, min, max, step, onChange, label, formatValue }) {
  const pct = ((Number(value) - Number(min)) / (Number(max) - Number(min))) * 100;
  return (
    <div className="flex w-full items-center gap-2">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onChange}
        className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-slate-700 accent-indigo-500"
        aria-label={label}
      />
      <span className="w-10 shrink-0 text-right text-xs font-mono text-slate-300">
        {formatValue ? formatValue(value) : value}
      </span>
    </div>
  );
}

function ToggleButton({ active, onToggle, labelOn, labelOff }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-all ${
        active
          ? 'bg-indigo-500/20 text-indigo-300 ring-1 ring-inset ring-indigo-500/40'
          : 'bg-slate-800 text-slate-400 ring-1 ring-inset ring-slate-700 hover:text-slate-200'
      }`}
    >
      {active ? labelOn : labelOff}
    </button>
  );
}

export default function VideoEditorPanel({ videoEditorSettings, setVideoEditorSettings, clampNum, onSaveVideoMeta }) {
  const { startAt, endAt, volume, playbackRate, muted, loop } = videoEditorSettings;

  return (
    <div className="px-5 py-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Configurações de reprodução</h3>
        <span className="rounded-md bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold text-violet-400 ring-1 ring-inset ring-violet-500/20">
          Metadados do canvas
        </span>
      </div>

      <div className="space-y-4 rounded-xl border border-slate-700/60 bg-slate-900/50 p-4">
        {/* Trim */}
        <div>
          <p className="mb-3 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            <FiClock size={11} />
            Trim (segundos)
          </p>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] text-slate-500">Início</span>
              <input
                type="number"
                min="0"
                step="0.1"
                value={startAt}
                onChange={(e) =>
                  setVideoEditorSettings((prev) => ({ ...prev, startAt: clampNum(e.target.value, 0, 21600, 0) }))
                }
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] text-slate-500">Fim (0 = até o final)</span>
              <input
                type="number"
                min="0"
                step="0.1"
                value={endAt}
                onChange={(e) =>
                  setVideoEditorSettings((prev) => ({ ...prev, endAt: clampNum(e.target.value, 0, 21600, 0) }))
                }
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
              />
            </label>
          </div>
        </div>

        <div className="h-px bg-slate-800" />

        {/* Volume */}
        <SettingRow label="Volume" icon={<FiVolume2 size={13} />}>
          <RangeWithValue
            label="Volume"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={(e) =>
              setVideoEditorSettings((prev) => ({ ...prev, volume: clampNum(e.target.value, 0, 1, 1) }))
            }
            formatValue={(v) => `${Math.round(Number(v) * 100)}%`}
          />
        </SettingRow>

        {/* Speed */}
        <SettingRow label="Velocidade" icon={<FiZap size={13} />}>
          <RangeWithValue
            label="Velocidade"
            min="0.25"
            max="2"
            step="0.25"
            value={playbackRate}
            onChange={(e) =>
              setVideoEditorSettings((prev) => ({
                ...prev,
                playbackRate: clampNum(e.target.value, 0.25, 2, 1),
              }))
            }
            formatValue={(v) => `${Number(v).toFixed(2)}x`}
          />
        </SettingRow>

        <div className="h-px bg-slate-800" />

        {/* Toggles */}
        <div className="flex flex-wrap items-center gap-2">
          <ToggleButton
            active={muted}
            onToggle={() => setVideoEditorSettings((prev) => ({ ...prev, muted: !prev.muted }))}
            labelOn={<><FiVolumeX size={11} /> Mudo</>}
            labelOff={<><FiVolume2 size={11} /> Som</>}
          />
          <ToggleButton
            active={loop}
            onToggle={() => setVideoEditorSettings((prev) => ({ ...prev, loop: !prev.loop }))}
            labelOn={<><FiRepeat size={11} /> Loop ativo</>}
            labelOff={<><FiRepeat size={11} /> Loop</>}
          />

          <button
            type="button"
            className="ml-auto rounded-lg bg-sky-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-sky-500"
            onClick={onSaveVideoMeta}
          >
            Salvar configurações
          </button>
        </div>

        <p className="text-[10px] leading-relaxed text-slate-600">
          Estas configurações são aplicadas quando o vídeo é inserido no canvas. Elementos já existentes não são
          afetados automaticamente.
        </p>
      </div>
    </div>
  );
}
