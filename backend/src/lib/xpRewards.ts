/** XP por página lida e por hora de leitura (regra do app). */
export const XP_PER_PAGE = 30;
export const XP_PER_HOUR = 30;
export const SECONDS_PER_HOUR = 3600;

/** Chave dentro de `profile.progress` (não é um livro). */
export const XP_META_PROGRESS_KEY = '__xp_meta';

export type XpMeta = {
  reading_seconds_remainder?: number;
  reading_seconds_total?: number;
  pages_awarded?: Record<string, number[]>;
};

export function parseJsonMap(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) };
  }
  return {};
}

function getXpMeta(progress: Record<string, unknown>): XpMeta {
  const raw = progress[XP_META_PROGRESS_KEY];
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as XpMeta;
  }
  return {};
}

export type PageAwardInput = { book_id: string; page_index: number };

export function applyReadingXpAwards(
  xpTotal: number,
  xpBalance: number,
  progressRaw: unknown,
  input: { pages?: PageAwardInput[]; reading_seconds?: number },
): {
  xpTotal: number;
  xpBalance: number;
  progress: Record<string, unknown>;
  xpGranted: number;
} {
  const progress = parseJsonMap(progressRaw);
  const meta = getXpMeta(progress);
  const pagesAwarded: Record<string, number[]> = {
    ...(meta.pages_awarded ?? {}),
  };
  let remainder = Number(meta.reading_seconds_remainder ?? 0);
  if (!Number.isFinite(remainder) || remainder < 0) remainder = 0;

  let granted = 0;

  for (const item of input.pages ?? []) {
    const bookId = String(item.book_id ?? '').trim();
    const pageIndex = Math.floor(Number(item.page_index));
    if (!bookId || !Number.isFinite(pageIndex) || pageIndex < 0) continue;

    const list = [...(pagesAwarded[bookId] ?? [])];
    if (list.includes(pageIndex)) continue;
    list.push(pageIndex);
    pagesAwarded[bookId] = list;
    granted += XP_PER_PAGE;
  }

  const seconds = Math.floor(Number(input.reading_seconds ?? 0));
  let secondsTotal = Number(meta.reading_seconds_total ?? 0);
  if (!Number.isFinite(secondsTotal) || secondsTotal < 0) secondsTotal = 0;

  if (Number.isFinite(seconds) && seconds > 0) {
    const capped = Math.min(seconds, 24 * SECONDS_PER_HOUR);
    remainder += capped;
    secondsTotal += capped;
    const fullHours = Math.floor(remainder / SECONDS_PER_HOUR);
    remainder %= SECONDS_PER_HOUR;
    granted += fullHours * XP_PER_HOUR;
  }

  progress[XP_META_PROGRESS_KEY] = {
    reading_seconds_remainder: remainder,
    reading_seconds_total: secondsTotal,
    pages_awarded: pagesAwarded,
  };

  return {
    xpTotal: xpTotal + granted,
    xpBalance: xpBalance + granted,
    progress,
    xpGranted: granted,
  };
}
