/** Tipos de atividade suportados na v1 do CMS (matching adiado na UI). */
export const ACTIVITY_TYPES = ['quiz', 'flashcard', 'trueFalse', 'fillBlank'] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const PUZZLE_PIECE_COUNTS = [15, 30, 60, 120, 240] as const;

export function isActivityType(v: unknown): v is ActivityType {
  return typeof v === 'string' && (ACTIVITY_TYPES as readonly string[]).includes(v);
}

export function parsePuzzlePieceCount(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return (PUZZLE_PIECE_COUNTS as readonly number[]).includes(n) ? Math.trunc(n) : null;
}

export function parseBoolean(v: unknown): boolean | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v === 'boolean') return v;
  const s = String(v).toLowerCase();
  if (s === 'true' || s === '1') return true;
  if (s === 'false' || s === '0') return false;
  return undefined;
}

export function parsePagination(query: Record<string, unknown>) {
  const limitRaw = Number(query.limit);
  const offsetRaw = Number(query.offset);
  const limit = Number.isFinite(limitRaw) ? Math.min(100, Math.max(1, Math.trunc(limitRaw))) : 50;
  const offset = Number.isFinite(offsetRaw) ? Math.max(0, Math.trunc(offsetRaw)) : 0;
  return { limit, offset };
}

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

/** Valida payload de criação/atualização de atividade CMS. */
export function validateActivityPayload(body: unknown): ValidationResult<{
  title: string;
  type: ActivityType;
  questions: unknown[];
}> {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Corpo inválido.' };
  }
  const b = body as Record<string, unknown>;
  const title = String(b.title || '').trim();
  const type = String(b.type || '').trim();
  if (!title) return { ok: false, error: 'title é obrigatório.' };
  if (!isActivityType(type)) {
    return { ok: false, error: `type inválido (${ACTIVITY_TYPES.join('|')}).` };
  }
  const questions = Array.isArray(b.questions) ? b.questions : [];
  return { ok: true, value: { title, type, questions } };
}

/** Valida payload de criação/atualização de puzzle CMS. */
export function validatePuzzlePayload(body: unknown): ValidationResult<{
  title: string;
  imageUrl: string;
  pieceCount: number;
}> {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Corpo inválido.' };
  }
  const b = body as Record<string, unknown>;
  const title = String(b.title || '').trim();
  const imageUrl = String(b.image_url ?? b.imageUrl ?? '').trim();
  if (!title) return { ok: false, error: 'title é obrigatório.' };
  if (!imageUrl) return { ok: false, error: 'image_url é obrigatório.' };
  const pieceCount = parsePuzzlePieceCount(b.piece_count ?? b.pieceCount);
  if (pieceCount === null) {
    return { ok: false, error: `piece_count inválido (${PUZZLE_PIECE_COUNTS.join('|')}).` };
  }
  return { ok: true, value: { title, imageUrl, pieceCount } };
}
