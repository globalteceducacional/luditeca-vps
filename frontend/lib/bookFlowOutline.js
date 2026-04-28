/**
 * Estrutura editorial leve dentro de `pages_v2` (sem alterar o canvas):
 * capítulos para organizar páginas + anexos (PDF/DOC) para o assistente.
 *
 * @typedef {{ id: string, title: string, order: number }} OutlineChapter
 * @typedef {{ id: string, name: string, url?: string, storage?: unknown, kind?: string, uploadedAt?: string }} OutlineAttachment
 * @typedef {{ chapters: OutlineChapter[], attachments?: OutlineAttachment[] }} BookOutline
 */

export const DEFAULT_CHAPTER_TITLE = 'Conteúdo principal';

export function newChapterId() {
  return `ch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** @param {unknown} v2 */
export function getOutlineFromV2(v2) {
  if (!v2 || typeof v2 !== 'object') return null;
  const o = /** @type {any} */ (v2).outline;
  if (!o || typeof o !== 'object') return null;
  const chapters = Array.isArray(o.chapters) ? o.chapters : [];
  const attachments = Array.isArray(o.attachments) ? o.attachments : [];
  return { chapters, attachments };
}

/**
 * Garante outline e meta.chapterId nas páginas (migração suave).
 * @param {any} v2
 */
export function ensureBookOutlineOnV2(v2) {
  if (!v2 || typeof v2 !== 'object' || v2.version !== 2 || !Array.isArray(v2.pages)) return v2;
  const next = JSON.parse(JSON.stringify(v2));
  let outline = getOutlineFromV2(next);
  if (!outline || !outline.chapters.length) {
    const cid = newChapterId();
    outline = {
      chapters: [{ id: cid, title: DEFAULT_CHAPTER_TITLE, order: 0 }],
      attachments: outline?.attachments || [],
    };
    next.outline = outline;
    next.pages.forEach((p) => {
      if (!p.meta || typeof p.meta !== 'object') p.meta = { orientation: 'landscape' };
      if (!p.meta.chapterId) p.meta.chapterId = cid;
    });
  } else {
    next.outline = {
      chapters: outline.chapters
        .map((c, i) => ({
          id: String(c.id || newChapterId()),
          title: String(c.title || `Capítulo ${i + 1}`),
          order: Number.isFinite(Number(c.order)) ? Number(c.order) : i,
        }))
        .sort((a, b) => a.order - b.order),
      attachments: outline.attachments || [],
    };
  }
  return next;
}

/**
 * @param {string[]} chapterTitles
 * @param {{ width?: number, height?: number }} [canvas]
 */
export function buildInitialV2FromChapters(chapterTitles, canvas = {}) {
  const w = canvas.width ?? 1280;
  const h = canvas.height ?? 720;
  const titles =
    Array.isArray(chapterTitles) && chapterTitles.length > 0
      ? chapterTitles.map((t) => String(t || '').trim() || DEFAULT_CHAPTER_TITLE)
      : [DEFAULT_CHAPTER_TITLE];
  const chapters = titles.map((title, i) => ({
    id: newChapterId(),
    title,
    order: i,
  }));
  const pages = chapters.map((ch, i) => ({
    id: `p-${Date.now()}-${i}`,
    background: null,
    nodes: [],
    meta: {
      orientation: 'landscape',
      chapterId: ch.id,
      pageLabel: `Abertura — ${ch.title}`,
    },
  }));
  return {
    version: 2,
    canvas: { width: w, height: h },
    outline: { chapters, attachments: [] },
    pages,
  };
}
