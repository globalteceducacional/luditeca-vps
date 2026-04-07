/**
 * Posição do botão de áudio **fora** da caixa do elemento (borda/canto),
 * definida por `audioBadgePlacement` ou `audioBadgeXPct`/`audioBadgeYPct` legados.
 */

import { clamp } from './editorUtils';

export const AUDIO_BADGE_R = 14;
export const AUDIO_BADGE_PAD = 6;
/** Espaço entre a caixa do nó e o badge (px). */
export const AUDIO_BADGE_OUTSET = 4;

export function normalizeAudioBadgePlacement(raw) {
  const s = String(raw || '').trim().toLowerCase();
  const allowed = ['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'];
  if (allowed.includes(s)) return s;
  return 'se';
}

/** Presets legados (percentuais no interior) — mapeados para canto/borda ao usar modo outside. */
export function cornerPlacementToPercent(placement) {
  const p = normalizeAudioBadgePlacement(placement);
  const map = {
    nw: { xPct: 14, yPct: 16 },
    ne: { xPct: 86, yPct: 16 },
    sw: { xPct: 14, yPct: 84 },
    se: { xPct: 86, yPct: 84 },
    n: { xPct: 50, yPct: 16 },
    s: { xPct: 50, yPct: 84 },
    w: { xPct: 14, yPct: 50 },
    e: { xPct: 86, yPct: 50 },
  };
  return map[p] || map.se;
}

export function resolveAudioBadgePercent(props) {
  if (!props) return cornerPlacementToPercent('se');
  const rawX = props.audioBadgeXPct;
  const rawY = props.audioBadgeYPct;
  if (
    rawX != null &&
    rawY != null &&
    Number.isFinite(Number(rawX)) &&
    Number.isFinite(Number(rawY))
  ) {
    return {
      xPct: clamp(Number(rawX), 0, 100),
      yPct: clamp(Number(rawY), 0, 100),
    };
  }
  return cornerPlacementToPercent(props.audioBadgePlacement);
}

/** Converte percentuais “interiores” legados para o preset outside mais próximo. */
export function percentToNearestOutsidePlacement(xPct, yPct) {
  const x = clamp(Number(xPct), 0, 100) / 100;
  const y = clamp(Number(yPct), 0, 100) / 100;
  const left = x < 0.35;
  const right = x > 0.65;
  const top = y < 0.35;
  const bottom = y > 0.65;
  if (top && left) return 'nw';
  if (top && right) return 'ne';
  if (bottom && left) return 'sw';
  if (bottom && right) return 'se';
  if (top) return 'n';
  if (bottom) return 's';
  if (left) return 'w';
  if (right) return 'e';
  return x < 0.5 ? 'w' : 'e';
}

/**
 * Canto sup. esq. do retângulo do badge (0,0 = canto sup. esq. da caixa do elemento),
 * com o círculo totalmente **fora** do retângulo [0,0]×[boxW,boxH].
 */
export function outsideTopLeftForPlacement(placement, boxW, boxH) {
  const playR = AUDIO_BADGE_R;
  const d = playR * 2;
  const o = AUDIO_BADGE_OUTSET;
  const p = normalizeAudioBadgePlacement(placement);
  switch (p) {
    case 'n':
      return { gx: boxW / 2 - playR, gy: -d - o };
    case 's':
      return { gx: boxW / 2 - playR, gy: boxH + o };
    case 'e':
      return { gx: boxW + o, gy: boxH / 2 - playR };
    case 'w':
      return { gx: -d - o, gy: boxH / 2 - playR };
    case 'nw':
      return { gx: -d - o, gy: -d - o };
    case 'ne':
      return { gx: boxW + o, gy: -d - o };
    case 'sw':
      return { gx: -d - o, gy: boxH + o };
    case 'se':
    default:
      return { gx: boxW + o, gy: boxH + o };
  }
}

/** Resolve props do nó para { gx, gy } outside da caixa. */
export function outsideTopLeftFromAudioProps(boxW, boxH, props) {
  const rawX = props?.audioBadgeXPct;
  const rawY = props?.audioBadgeYPct;
  const hasPct =
    rawX != null &&
    rawY != null &&
    Number.isFinite(Number(rawX)) &&
    Number.isFinite(Number(rawY));
  const placement = hasPct
    ? percentToNearestOutsidePlacement(Number(rawX), Number(rawY))
    : normalizeAudioBadgePlacement(props?.audioBadgePlacement);
  return outsideTopLeftForPlacement(placement, boxW, boxH);
}
