/**
 * Utilitários numéricos e de detecção de mídia compartilhados por todos os módulos do editor.
 *
 * Importe sempre daqui em vez de redefinir localmente em cada componente.
 */

/** Converte um valor para número; retorna `fallback` se NaN / Infinity. */
export function toNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Limita `n` ao intervalo [min, max]. */
export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

/** Arredonda para 2 casas decimais. */
export function round2(n) {
  return Math.round(Number(n || 0) * 100) / 100;
}
