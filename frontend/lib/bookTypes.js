/** Caminhos alternativos de criação (hub em /books/new). */
export const BOOK_CREATION_PATHS = {
  appTypes: {
    id: 'app-types',
    title: 'Livro para a app infantil',
    description:
      'História com páginas animadas, escolhas interativas ou PDF/EPUB. Publica na biblioteca da app.',
    href: null,
    recommended: true,
  },
  wizard: {
    id: 'wizard',
    title: 'Livro com editor visual (canvas)',
    description:
      'Ideal se tens PowerPoint ou queres desenhar páginas no canvas (Konva). Não usa os tipos animado/interativo/digital.',
    href: '/books/new-wizard',
    badge: 'PPTX / capítulos',
  },
};

/** Tipos editoriais do fluxo Base44 (imutável após criação). */
export const BOOK_TYPES = [
  {
    id: 'animated',
    title: 'Livro animado',
    description: 'Páginas com imagens/GIF, texto e trilha sonora opcional.',
    whenToUse: 'Slides simples, imagens por página, sem ramificações.',
    icon: '🎬',
  },
  {
    id: 'interactive',
    title: 'Livro interativo',
    description: 'Cenas com escolhas que levam a outros caminhos na história.',
    whenToUse: 'História ramificada: o leitor escolhe o que acontece a seguir.',
    icon: '🔀',
  },
  {
    id: 'digital',
    title: 'E-book digital',
    description: 'PDF ou EPUB com capa e metadados.',
    whenToUse: 'Já tens o livro pronto em PDF ou EPUB.',
    icon: '📕',
  },
];

/** Rótulos para breadcrumbs e UI. */
export const BOOK_TYPE_LABELS = {
  animated: 'Livro animado',
  interactive: 'Livro interativo',
  digital: 'E-book digital',
};

export const BOOK_TYPE_FLOW_STEPS = [
  { id: 'metadata', label: 'Ficha do livro' },
  { id: 'content', label: 'Conteúdo' },
  { id: 'publish', label: 'Publicação' },
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
