import { prisma } from './prisma.js';

export type BookIndexParts = {
  title: string;
  description?: string | null;
  authorLine?: string | null;
  categoryName?: string | null;
  catalogCollection?: string | null;
  catalogLevel?: string | null;
  catalogCharacters?: unknown;
  catalogKeywords?: unknown;
};

function norm(s: string | null | undefined): string {
  return String(s || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function jsonStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x) => typeof x === 'string')
    .map((x) => String(x).trim())
    .filter(Boolean);
}

/** Texto único em minúsculas para filtros ILIKE / contains (índice denormalizado). */
export function buildSearchIndexText(parts: BookIndexParts): string {
  const chars = jsonStringArray(parts.catalogCharacters).map((s) => norm(s)).filter(Boolean);
  const kws = jsonStringArray(parts.catalogKeywords).map((s) => norm(s)).filter(Boolean);
  const segments = [
    norm(parts.title),
    norm(parts.description ?? undefined),
    norm(parts.authorLine ?? undefined),
    norm(parts.categoryName ?? undefined),
    norm(parts.catalogCollection ?? undefined),
    norm(parts.catalogLevel ?? undefined),
    ...chars,
    ...kws,
  ].filter(Boolean);
  return segments.join(' ').replace(/\s+/g, ' ').trim();
}

export function parseCatalogStringArrayFromBody(v: unknown): string[] | undefined {
  if (v === undefined) return undefined;
  if (v === null) return [];
  if (Array.isArray(v)) return jsonStringArray(v);
  if (typeof v === 'string') {
    return v
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return undefined;
}

export async function persistBookSearchIndex(bookId: bigint): Promise<void> {
  const row = await prisma.book.findUnique({
    where: { id: bookId },
    include: { authorRel: true, categoryRel: true },
  });
  if (!row) return;
  const text = buildSearchIndexText({
    title: row.title,
    description: row.description,
    authorLine: row.authorRel?.name ?? row.author ?? '',
    categoryName: row.categoryRel?.name ?? '',
    catalogCollection: row.catalogCollection,
    catalogLevel: row.catalogLevel,
    catalogCharacters: row.catalogCharacters,
    catalogKeywords: row.catalogKeywords,
  });
  await prisma.book.update({
    where: { id: bookId },
    data: { searchIndex: text },
  });
}
