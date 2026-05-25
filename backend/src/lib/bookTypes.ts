import { BookType } from '@prisma/client';

export const BOOK_TYPE_VALUES: BookType[] = [
  BookType.animated,
  BookType.interactive,
  BookType.digital,
];

const BOOK_TYPE_SET = new Set<string>(BOOK_TYPE_VALUES);
const PAGE_TYPE_INTERACTIVE_META = 'interactive_meta';

function getInteractivePageKey(scene: Record<string, unknown>): string {
  const n = Number(scene.page_id);
  if (Number.isFinite(n) && n > 0 && Math.floor(n) === n) return String(n);
  return String(scene.scene_id ?? '').trim();
}

function getChoiceTargetKey(ch: Record<string, unknown>): string {
  const n = Number(ch.target_page_id);
  if (Number.isFinite(n) && n > 0) return String(n);
  return String(ch.target_scene_id ?? '').trim();
}

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

export type BookPagesValidationOpts = {
  /** Rascunho permite conteúdo incompleto; publicado exige regras completas. */
  workflowStatus?: string | null;
};

function isPublishedWorkflow(status: string | null | undefined): boolean {
  return String(status ?? '').trim().toLowerCase() === 'published';
}

/** Valida `pages[]` do fluxo por tipo antes de gravar. */
export function validateBookTypePages(
  bookType: BookType,
  pages: unknown,
  opts: BookPagesValidationOpts = {},
): ValidationResult {
  const strict = isPublishedWorkflow(opts.workflowStatus);

  if (bookType === BookType.digital) {
    return { ok: true };
  }

  if (!Array.isArray(pages) || pages.length === 0) {
    if (!strict) return { ok: true };
    return { ok: false, error: 'Adicione pelo menos uma página ou cena.' };
  }

  if (bookType === BookType.animated) {
    let readingCount = 0;
    for (let i = 0; i < pages.length; i += 1) {
      const row = pages[i];
      if (!row || typeof row !== 'object') {
        return { ok: false, error: `Bloco ${i + 1} inválido.` };
      }
      const pageType = String((row as Record<string, unknown>).page_type ?? 'reading')
        .trim()
        .toLowerCase();
      if (pageType === 'quiz') {
        const question = String((row as Record<string, unknown>).question ?? '').trim();
        const options = Array.isArray((row as Record<string, unknown>).options)
          ? ((row as Record<string, unknown>).options as unknown[])
          : [];
        const filled = options.map((o) => String(o ?? '').trim()).filter(Boolean);
        if (strict && (!question || filled.length < 2)) {
          return { ok: false, error: `Pergunta de quiz na posição ${i + 1} incompleta.` };
        }
        continue;
      }
      readingCount += 1;
      const imageUrl = String((row as Record<string, unknown>).image_url ?? '').trim();
      if (strict && !imageUrl) {
        return { ok: false, error: `Página na posição ${i + 1} precisa de imagem.` };
      }
    }
    if (strict && readingCount === 0) {
      return { ok: false, error: 'Adicione pelo menos uma página de leitura com imagem.' };
    }
    return { ok: true };
  }

  const sceneIds = new Set<string>();
  let hasStart = false;
  let sceneCount = 0;
  for (let i = 0; i < pages.length; i += 1) {
    const row = pages[i];
    if (!row || typeof row !== 'object') {
      return { ok: false, error: `Bloco ${i + 1} inválido.` };
    }
    const scene = row as Record<string, unknown>;
    const pageType = String(scene.page_type ?? '').trim().toLowerCase();
    if (pageType === 'quiz') {
      const question = String(scene.question ?? '').trim();
      const options = Array.isArray(scene.options) ? scene.options : [];
      const filled = options.map((o) => String(o ?? '').trim()).filter(Boolean);
      if (strict && (!question || filled.length < 2)) {
        return { ok: false, error: `Pergunta de quiz na posição ${i + 1} incompleta.` };
      }
      continue;
    }
    if (pageType === PAGE_TYPE_INTERACTIVE_META) continue;
    sceneCount += 1;
    const sceneId = getInteractivePageKey(scene);
    if (!sceneId) {
      return { ok: false, error: `Página ${i + 1} sem ID (page_id ou scene_id).` };
    }
    if (sceneIds.has(sceneId)) {
      return { ok: false, error: `Cena ${i + 1}: identificador duplicado.` };
    }
    sceneIds.add(sceneId);
    if (scene.is_start) hasStart = true;
    // Interativo: imagem opcional (história pode ser só texto + escolhas).
  }

  for (const row of pages) {
    if (!row || typeof row !== 'object') continue;
    const scene = row as Record<string, unknown>;
    const pt = String(scene.page_type ?? '').trim().toLowerCase();
    if (pt === 'quiz' || pt === PAGE_TYPE_INTERACTIVE_META) continue;
    const choices = Array.isArray(scene.choices) ? scene.choices : [];
    for (const ch of choices) {
      if (!ch || typeof ch !== 'object') continue;
      const target = getChoiceTargetKey(ch as Record<string, unknown>);
      if (target && !sceneIds.has(target)) {
        return { ok: false, error: 'Uma escolha aponta para uma página que não existe.' };
      }
    }
  }

  if (strict && sceneCount > 1 && !hasStart) {
    return { ok: false, error: 'Marque qual cena inicia a história.' };
  }
  if (strict && sceneCount === 0) {
    return { ok: false, error: 'Adicione pelo menos uma cena.' };
  }

  return { ok: true };
}

/** Livro digital: exige PDF ou EPUB quando publicado (ou validação estrita). */
export function validateDigitalBookAssets(
  body: Record<string, unknown>,
  opts: BookPagesValidationOpts = {},
): ValidationResult {
  const strict = isPublishedWorkflow(opts.workflowStatus);
  const pdf = parseOptionalUrl(body.pdf_url ?? body.pdfUrl);
  const epub = parseOptionalUrl(body.epub_url ?? body.epubUrl);
  if (pdf || epub) return { ok: true };
  if (!strict) return { ok: true };
  return { ok: false, error: 'Envie pelo menos um ficheiro PDF ou EPUB.' };
}
