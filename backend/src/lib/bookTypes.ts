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

type ValidationResult = { ok: true } | { ok: false; error: string };

/** Valida `pages[]` do fluxo por tipo antes de gravar. */
export function validateBookTypePages(
  bookType: BookType,
  pages: unknown,
): ValidationResult {
  if (bookType === BookType.digital) {
    return { ok: true };
  }

  if (!Array.isArray(pages) || pages.length === 0) {
    return { ok: false, error: 'Adicione pelo menos uma página ou cena.' };
  }

  if (bookType === BookType.animated) {
    for (let i = 0; i < pages.length; i += 1) {
      const row = pages[i];
      if (!row || typeof row !== 'object') {
        return { ok: false, error: `Página ${i + 1} inválida.` };
      }
      const imageUrl = String((row as Record<string, unknown>).image_url ?? '').trim();
      if (!imageUrl) {
        return { ok: false, error: `Página ${i + 1} precisa de imagem (image_url).` };
      }
    }
    return { ok: true };
  }

  const sceneIds = new Set<string>();
  let hasStart = false;
  for (let i = 0; i < pages.length; i += 1) {
    const row = pages[i];
    if (!row || typeof row !== 'object') {
      return { ok: false, error: `Cena ${i + 1} inválida.` };
    }
    const scene = row as Record<string, unknown>;
    const sceneId = String(scene.scene_id ?? '').trim();
    if (!sceneId) {
      return { ok: false, error: `Cena ${i + 1} precisa de scene_id.` };
    }
    if (sceneIds.has(sceneId)) {
      return { ok: false, error: `scene_id duplicado: ${sceneId}.` };
    }
    sceneIds.add(sceneId);
    if (scene.is_start) hasStart = true;
  }

  for (const row of pages) {
    if (!row || typeof row !== 'object') continue;
    const scene = row as Record<string, unknown>;
    const choices = Array.isArray(scene.choices) ? scene.choices : [];
    for (const ch of choices) {
      if (!ch || typeof ch !== 'object') continue;
      const target = String((ch as Record<string, unknown>).target_scene_id ?? '').trim();
      if (target && !sceneIds.has(target)) {
        return { ok: false, error: `Escolha aponta para scene_id inexistente: ${target}.` };
      }
    }
  }

  if (!hasStart && pages.length > 1) {
    return { ok: false, error: 'Marque pelo menos uma cena como inicial (is_start).' };
  }

  return { ok: true };
}

/** Livro digital: exige PDF ou EPUB no create/update completo. */
export function validateDigitalBookAssets(body: Record<string, unknown>): ValidationResult {
  const pdf = parseOptionalUrl(body.pdf_url ?? body.pdfUrl);
  const epub = parseOptionalUrl(body.epub_url ?? body.epubUrl);
  if (pdf || epub) return { ok: true };
  return { ok: false, error: 'Envie pelo menos um ficheiro PDF ou EPUB.' };
}
