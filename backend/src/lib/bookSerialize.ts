import type { Prisma } from '@prisma/client';
import { jsonSafe } from './serialize.js';

/**
 * Projeção leve para listagens (catálogo / app library).
 * Exclui `pages`, `pagesV2`, `searchIndex`, `linkSlidebook`.
 */
export const BOOK_CARD_SELECT = {
  id: true,
  title: true,
  author: true,
  description: true,
  coverImage: true,
  createdAt: true,
  workflowStatus: true,
  bookType: true,
  ageRange: true,
  isPdf: true,
  authorId: true,
  categoryId: true,
  catalogCollection: true,
  catalogLevel: true,
  catalogCharacters: true,
  catalogKeywords: true,
  authorRel: { select: { id: true, name: true } },
  categoryRel: { select: { id: true, name: true } },
} satisfies Prisma.BookSelect;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function bookCardResponse(b: any) {
  if (!b) return null;
  const { authorRel, categoryRel, ...rest } = b;
  return {
    ...jsonSafe(rest),
    authors: authorRel
      ? { id: Number(authorRel.id), name: authorRel.name }
      : null,
    category: categoryRel
      ? { id: Number(categoryRel.id), name: categoryRel.name }
      : null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function bookResponse(b: any) {
  if (!b) return null;
  const { authorRel, categoryRel, searchIndex: _searchIndex, ...rest } = b;
  return {
    ...jsonSafe(rest),
    authors: authorRel
      ? { id: Number(authorRel.id), name: authorRel.name }
      : null,
    category: categoryRel
      ? { id: Number(categoryRel.id), name: categoryRel.name }
      : null,
  };
}

/** Lê e clampa `limit` (1..100, default 50) e `offset` (>=0, default 0). */
export function parseLimitOffset(query: Record<string, string | undefined>) {
  const limitRaw = parseInt(String(query.limit ?? ''), 10);
  const offsetRaw = parseInt(String(query.offset ?? ''), 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(100, Math.max(1, limitRaw)) : 50;
  const skip = Number.isFinite(offsetRaw) ? Math.max(0, offsetRaw) : 0;
  return { limit, skip };
}
