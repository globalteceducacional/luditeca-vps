import { XP_META_PROGRESS_KEY, parseJsonMap, type XpMeta } from './xpRewards.js';
import { levelFromTotalXp } from './xpLevel.js';

function getXpMeta(progress: Record<string, unknown>): XpMeta {
  const raw = progress[XP_META_PROGRESS_KEY];
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as XpMeta;
  }
  return {};
}

export function countPagesRead(progress: Record<string, unknown>): number {
  const awarded = getXpMeta(progress).pages_awarded ?? {};
  return Object.values(awarded).reduce(
    (sum, pages) => sum + (Array.isArray(pages) ? pages.length : 0),
    0,
  );
}

export function countReadingHours(progress: Record<string, unknown>): number {
  const totalSeconds = Number(getXpMeta(progress).reading_seconds_total ?? 0);
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return 0;
  return Math.floor(totalSeconds / 3600);
}

export type ProfileStats = {
  pages_read: number;
  books_read: number;
  reading_hours: number;
  favorites: number;
  level: number;
  xp_total: number;
};

export function buildProfileStats(input: {
  progress: unknown;
  booksRead: number | bigint | null | undefined;
  favorites: unknown;
  xpTotal: number;
}): ProfileStats {
  const progress = parseJsonMap(input.progress);
  const favorites = Array.isArray(input.favorites) ? input.favorites.length : 0;
  const booksRead = Number(input.booksRead ?? 0);
  const xpTotal = Math.max(0, Math.floor(input.xpTotal));

  return {
    pages_read: countPagesRead(progress),
    books_read: Number.isFinite(booksRead) ? Math.floor(booksRead) : 0,
    reading_hours: countReadingHours(progress),
    favorites,
    level: levelFromTotalXp(xpTotal),
    xp_total: xpTotal,
  };
}
