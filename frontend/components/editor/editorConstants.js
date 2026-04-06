export const MAX_TIMELINE_STEP = 20;
export const MIN_VISIBLE_TIMELINE_STEPS = 5;

/**
 * Lista única de famílias tipográficas do editor (CanvasStageKonva / painéis v2).
 * Inclui Google Fonts usadas na app e fontes de sistema comuns em importações/PPTX.
 */
const _EDITOR_FONT_NAMES = [
  'Arial',
  'Arial Black',
  'Book Antiqua',
  'Bookman Old Style',
  'Calibri',
  'Cambria',
  'Century Gothic',
  'Comic Sans MS',
  'Courier New',
  'Dosis',
  'Garamond',
  'Georgia',
  'Impact',
  'Inter',
  'Lato',
  'Lucida Sans Unicode',
  'Merriweather',
  'Montserrat',
  'Nunito',
  'Open Sans',
  'Palatino Linotype',
  'Poppins',
  'Raleway',
  'Roboto',
  'Segoe UI',
  'Tahoma',
  'Times New Roman',
  'Trebuchet MS',
  'Verdana',
];

export const EDITOR_FONT_OPTIONS = [...new Set(_EDITOR_FONT_NAMES)].sort((a, b) =>
  a.localeCompare(b, 'pt', { sensitivity: 'base' }),
);

/** Opções `{ value, label }` para `<select>` de fonte no editor. */
export const EDITOR_FONT_SELECT_OPTIONS = EDITOR_FONT_OPTIONS.map((name) => ({
  value: name,
  label: name,
}));
