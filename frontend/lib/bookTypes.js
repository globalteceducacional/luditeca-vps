/** Tipos editoriais do fluxo Base44 (imutável após criação). */
export const BOOK_TYPES = [
  {
    id: 'animated',
    title: 'Livro animado',
    description: 'Páginas com imagens/GIF, texto e trilha sonora opcional.',
    icon: '🎬',
  },
  {
    id: 'interactive',
    title: 'Livro interativo',
    description: 'Cenas com escolhas que levam a outros caminhos na história.',
    icon: '🔀',
  },
  {
    id: 'digital',
    title: 'E-book digital',
    description: 'PDF ou EPUB com capa e metadados.',
    icon: '📕',
  },
];

const BOOK_TYPE_IDS = new Set(BOOK_TYPES.map((t) => t.id));

export function isValidBookType(id) {
  return BOOK_TYPE_IDS.has(String(id || '').trim());
}

export function getBookTypeMeta(id) {
  return BOOK_TYPES.find((t) => t.id === id) || null;
}

export function getBookTypeLabel(id) {
  const meta = getBookTypeMeta(id);
  if (meta) return meta.title;
  const s = String(id || '').trim();
  return s || null;
}

export function bookTypeBadgeColor(id) {
  switch (id) {
    case 'animated':
      return 'primary';
    case 'interactive':
      return 'warning';
    case 'digital':
      return 'info';
    default:
      return 'secondary';
  }
}

/** Rota de edição CMS: fluxo por tipo ou editor visual v2 (legado). */
export function getBookEditHref(book) {
  const id = book?.id;
  if (!id) return '/books';
  return book?.book_type ? `/books/${id}/edit-flow` : `/books/${id}/edit-v2`;
}

/** Ordenação numérica por nome de ficheiro (Base44). */
export function sortFilesByNumericName(files) {
  return [...files].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }),
  );
}

export function emptyQuizQuestion() {
  return { question: '', options: ['', '', '', ''], correct: 0 };
}

export function normalizeQuizForApi(questions) {
  if (!Array.isArray(questions)) return [];
  return questions
    .map((q) => {
      const question = String(q?.question ?? '').trim();
      const options = (Array.isArray(q?.options) ? q.options : [])
        .map((o) => String(o ?? '').trim())
        .filter(Boolean);
      if (!question || options.length < 2) return null;
      const correct = Number.isFinite(Number(q.correct))
        ? Math.max(0, Math.min(options.length - 1, Number(q.correct)))
        : 0;
      return { question, options, correct };
    })
    .filter(Boolean);
}
