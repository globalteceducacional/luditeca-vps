import { BookType } from '@prisma/client';

export const BOOK_TYPE_VALUES: BookType[] = [
  BookType.animated,
  BookType.interactive,
  BookType.digital,
];

const BOOK_TYPE_SET = new Set<string>(BOOK_TYPE_VALUES);

export function parseBookType(v: unknown): BookType | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  const s = String(v).trim();
  if (!BOOK_TYPE_SET.has(s)) return undefined;
  return s as BookType;
}

/** Normaliza quiz do livro (paridade Base44: question + options + correct index). */
export function normalizeBookQuiz(raw: unknown): object[] | null | undefined {
  if (raw === null) return null;
  if (!Array.isArray(raw)) return undefined;
  const out: object[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const question = String(row.question ?? '').trim();
    if (!question) continue;
    const options = Array.isArray(row.options)
      ? row.options.map((o) => String(o ?? '').trim()).filter(Boolean)
      : [];
    if (options.length < 2) continue;
    const correctRaw = row.correct;
    const correct = Number.isFinite(Number(correctRaw))
      ? Math.max(0, Math.min(options.length - 1, Number(correctRaw)))
      : 0;
    out.push({ question, options, correct });
  }
  return out;
}

export function parseOptionalUrl(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  return String(v).trim() || null;
}

export function parseOptionalString(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  return String(v).trim() || null;
}
