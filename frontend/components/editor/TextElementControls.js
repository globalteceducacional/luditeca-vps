import React, { useState } from 'react';
import {
  FiPlay,
  FiCopy,
  FiChevronUp,
  FiChevronDown,
  FiTrash2,
  FiMoreVertical,
  FiAlignLeft,
  FiAlignCenter,
  FiAlignRight
} from 'react-icons/fi';

const AVAILABLE_FONTS = [
  { value: 'Century Gothic', label: 'Century Gothic' },
  { value: 'Bookman Old Style', label: 'Bookman Old Style' },
  { value: 'Calibri', label: 'Calibri' },
  { value: 'Arial', label: 'Arial' },
  { value: 'Times New Roman', label: 'Times New Roman' },
  { value: 'Verdana', label: 'Verdana' },
  { value: 'Tahoma', label: 'Tahoma' },
  { value: 'Trebuchet MS', label: 'Trebuchet MS' },
  { value: 'Georgia', label: 'Georgia' },
  { value: 'Garamond', label: 'Garamond' },
  { value: 'Cambria', label: 'Cambria' },
  { value: 'Segoe UI', label: 'Segoe UI' },
  { value: 'Impact', label: 'Impact' },
  { value: 'Courier New', label: 'Courier New' },
  { value: 'Lucida Sans Unicode', label: 'Lucida Sans Unicode' },
  { value: 'Palatino Linotype', label: 'Palatino Linotype' },
  { value: 'Book Antiqua', label: 'Book Antiqua' },
  { value: 'Arial Black', label: 'Arial Black' },
  { value: 'Comic Sans MS', label: 'Comic Sans MS' },
  { value: 'Roboto', label: 'Roboto' },
  { value: 'Open Sans', label: 'Open Sans' },
  { value: 'Nunito', label: 'Nunito' },
  { value: 'Poppins', label: 'Poppins' },
  { value: 'Merriweather', label: 'Merriweather' },
];

const TextElementControls = ({
  element,
  onPlayAnimation,
  handleElementChange,
  onDuplicateElement,
  onMoveForward,
  onMoveBackward,
  onRemoveElement
}) => {
  const [showSecondaryMenu, setShowSecondaryMenu] = useState(false);
  const currentFont = element.fontFamily || 'Roboto';
  const fontOptions = AVAILABLE_FONTS.some((f) => f.value === currentFont)
    ? AVAILABLE_FONTS
    : [{ value: currentFont, label: `${currentFont} (importada)` }, ...AVAILABLE_FONTS];
  const updateText = (payload) => {
    handleElementChange(element.id, {
      ...payload,
      contentSpans: undefined,
    });
  };
  const btnClass =
    'rounded-md p-1.5 text-slate-300 transition-colors hover:bg-slate-700 hover:text-white';
  const activeBtnClass =
    'rounded-md bg-indigo-600 p-1.5 text-white shadow-sm transition-colors';

  return (
    <>
      <div className="absolute -top-14 left-0 z-50 flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/95 p-1.5 shadow-xl backdrop-blur-md">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPlayAnimation(element.id, element.animation);
          }}
          title="Testar animação"
          className="rounded-md p-1.5 text-emerald-400 transition-colors hover:bg-emerald-400/10 hover:text-emerald-300"
        >
          <FiPlay size={14} />
        </button>

        <div className="mx-1 h-5 w-px bg-slate-700" />

        <select
          value={currentFont}
          onChange={(e) => {
            e.stopPropagation();
            updateText({ fontFamily: e.target.value });
          }}
          className="w-[110px] truncate rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 outline-none focus:border-indigo-500"
          style={{ fontFamily: currentFont }}
        >
          {fontOptions.map((font) => (
            <option
              key={font.value}
              value={font.value}
              style={{ fontFamily: font.value }}
            >
              {font.label}
            </option>
          ))}
        </select>

        <select
          value={element.fontSize || 16}
          onChange={(e) => {
            e.stopPropagation();
            updateText({ fontSize: parseInt(e.target.value, 10) });
          }}
          className="ml-1 w-[50px] rounded border border-slate-700 bg-slate-900 px-1 py-1 text-center text-xs text-slate-200 outline-none focus:border-indigo-500"
        >
          {[10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64].map((size) => (
            <option key={size} value={size}>{size}</option>
          ))}
        </select>

        <div className="mx-1 h-5 w-px bg-slate-700" />

        <button
          onClick={(e) => {
            e.stopPropagation();
            const newWeight = element.fontWeight === 'bold' ? 'normal' : 'bold';
            updateText({ fontWeight: newWeight });
          }}
          className={element.fontWeight === 'bold' ? activeBtnClass : btnClass}
          title="Negrito"
        >
          <span className="text-xs font-bold leading-none">B</span>
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            const newStyle = element.fontStyle === 'italic' ? 'normal' : 'italic';
            updateText({ fontStyle: newStyle });
          }}
          className={element.fontStyle === 'italic' ? activeBtnClass : btnClass}
          title="Italico"
        >
          <span className="font-serif text-xs italic leading-none">I</span>
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            const next = element.textDecoration === 'underline' ? 'none' : 'underline';
            updateText({ textDecoration: next });
          }}
          className={element.textDecoration === 'underline' ? activeBtnClass : btnClass}
          title="Sublinhado"
        >
          <span className="text-xs leading-none underline">U</span>
        </button>

        <div className="relative mx-1 flex items-center">
          <input
            type="color"
            value={element.color || '#000000'}
            onChange={(e) => {
              e.stopPropagation();
              updateText({ color: e.target.value });
            }}
            className="h-6 w-6 cursor-pointer overflow-hidden rounded border-0 bg-transparent p-0"
            title="Cor do texto"
          />
        </div>

        <div className="mx-1 h-5 w-px bg-slate-700" />

        <button
          onClick={(e) => {
            e.stopPropagation();
            updateText({ textAlign: 'left' });
          }}
          className={element.textAlign === 'left' || !element.textAlign ? activeBtnClass : btnClass}
          title="Alinhar a esquerda"
        >
          <FiAlignLeft size={14} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            updateText({ textAlign: 'center' });
          }}
          className={element.textAlign === 'center' ? activeBtnClass : btnClass}
          title="Centralizar"
        >
          <FiAlignCenter size={14} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            updateText({ textAlign: 'right' });
          }}
          className={element.textAlign === 'right' ? activeBtnClass : btnClass}
          title="Alinhar a direita"
        >
          <FiAlignRight size={14} />
        </button>

        <div className="mx-1 h-5 w-px bg-slate-700" />

        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowSecondaryMenu(!showSecondaryMenu);
            }}
            className={showSecondaryMenu ? activeBtnClass : btnClass}
            title="Mais opcoes"
          >
            <FiMoreVertical size={14} />
          </button>

          {showSecondaryMenu && (
            <div
              className="absolute left-1/2 top-full z-50 mt-2 w-48 -translate-x-1/2 rounded-lg border border-slate-700 bg-slate-800 py-2 text-slate-300 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="border-b border-slate-700 px-3 py-2">
                <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">
                  Espacamento de linha
                </label>
                <select
                  value={element.lineHeight || 1.35}
                  onChange={(e) => {
                    e.stopPropagation();
                    updateText({ lineHeight: parseFloat(e.target.value) });
                  }}
                  className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-white outline-none"
                >
                  {[1, 1.15, 1.35, 1.5, 1.8, 2].map((lh) => (
                    <option key={lh} value={lh}>{lh}x</option>
                  ))}
                </select>
                <label className="mb-1 mt-3 block text-[10px] font-bold uppercase text-slate-500">
                  Entre letras
                </label>
                <select
                  value={element.letterSpacing ?? 0}
                  onChange={(e) => {
                    e.stopPropagation();
                    updateText({ letterSpacing: parseFloat(e.target.value) });
                  }}
                  className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-white outline-none"
                >
                  {[-1, -0.5, 0, 0.5, 1, 1.5, 2].map((ls) => (
                    <option key={ls} value={ls}>{ls}px</option>
                  ))}
                </select>
              </div>

              <div className="pt-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicateElement(element.id);
                  setShowSecondaryMenu(false);
                }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-slate-700 hover:text-white"
              >
                  <FiCopy size={12} />
                <span>Duplicar</span>
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveForward(element.id);
                  setShowSecondaryMenu(false);
                }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-slate-700 hover:text-white"
              >
                  <FiChevronUp size={12} />
                  Trazer para frente
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveBackward(element.id);
                  setShowSecondaryMenu(false);
                }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-slate-700 hover:text-white"
              >
                  <FiChevronDown size={12} />
                  Enviar para tras
              </button>

                <div className="my-1 border-t border-slate-700" />

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveElement(element.id);
                  setShowSecondaryMenu(false);
                }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
              >
                  <FiTrash2 size={12} />
                <span>Remover</span>
              </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default TextElementControls; 