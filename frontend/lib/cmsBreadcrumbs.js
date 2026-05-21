import { BOOK_TYPE_LABELS } from './bookTypes';

const BOOK_TYPE_SLUGS = new Set(['animated', 'interactive', 'digital']);

/**
 * Gera breadcrumbs para rotas CMS com base no pathname Next.js.
 * @param {string} pathname
 * @param {{ bookTitle?: string, authorName?: string, categoryName?: string }} [ctx]
 * @returns {{ label: string, href?: string }[]}
 */
export function buildCmsBreadcrumbs(pathname, ctx = {}) {
  const items = [{ label: 'Painel', href: '/books' }];

  if (pathname === '/books' || pathname === '/books/') {
    items.push({ label: 'Livros' });
    return items;
  }

  if (pathname.startsWith('/books/new-wizard')) {
    items.push({ label: 'Livros', href: '/books' });
    items.push({ label: 'Assistente PPTX' });
    return items;
  }

  if (pathname === '/books/new') {
    items.push({ label: 'Livros', href: '/books' });
    items.push({ label: 'Novo livro' });
    return items;
  }

  const newTypeMatch = pathname.match(/^\/books\/new\/([^/]+)$/);
  if (newTypeMatch && BOOK_TYPE_SLUGS.has(newTypeMatch[1])) {
    const type = newTypeMatch[1];
    items.push({ label: 'Livros', href: '/books' });
    items.push({ label: 'Novo livro', href: '/books/new' });
    items.push({ label: BOOK_TYPE_LABELS[type] || type });
    return items;
  }

  if (pathname.includes('/edit-flow')) {
    items.push({ label: 'Livros', href: '/books' });
    if (ctx.bookTitle) {
      items.push({ label: ctx.bookTitle, href: pathname.split('?')[0].replace(/\/edit-flow$/, '') });
    }
    items.push({ label: 'Edição por tipo' });
    return items;
  }

  if (pathname.startsWith('/books/')) {
    items.push({ label: 'Livros', href: '/books' });
    if (ctx.bookTitle) items.push({ label: ctx.bookTitle });
    else items.push({ label: 'Detalhe' });
    return items;
  }

  if (pathname === '/authors/new') {
    items.push({ label: 'Autores', href: '/authors' });
    items.push({ label: 'Novo autor' });
    return items;
  }

  if (pathname.match(/^\/authors\/[^/]+\/edit$/)) {
    items.push({ label: 'Autores', href: '/authors' });
    items.push({ label: ctx.authorName || 'Editar autor' });
    return items;
  }

  if (pathname.startsWith('/authors')) {
    items.push({ label: 'Autores' });
    return items;
  }

  if (pathname === '/categories/new') {
    items.push({ label: 'Categorias', href: '/categories' });
    items.push({ label: 'Nova categoria' });
    return items;
  }

  if (pathname.match(/^\/categories\/[^/]+\/edit$/)) {
    items.push({ label: 'Categorias', href: '/categories' });
    items.push({ label: ctx.categoryName || 'Editar categoria' });
    return items;
  }

  if (pathname.startsWith('/categories')) {
    items.push({ label: 'Categorias' });
    return items;
  }

  const ADMIN_SECTIONS = [
    { prefix: '/admin/users', label: 'Utilizadores' },
    { prefix: '/admin/audit', label: 'Trilha de ações' },
    { prefix: '/admin/telemetry', label: 'Telemetria' },
    { prefix: '/admin/activities', label: 'Atividades' },
    { prefix: '/admin/libras', label: 'Lições LIBRAS' },
    { prefix: '/admin/puzzle', label: 'Quebra-cabeça' },
    { prefix: '/admin/coloring', label: 'Pinturas' },
  ];

  for (const section of ADMIN_SECTIONS) {
    if (pathname.startsWith(section.prefix)) {
      items.push({ label: 'Administração', href: '/admin' });
      if (pathname.endsWith('/edit') || pathname.endsWith('/new/edit')) {
        items.push({ label: section.label, href: section.prefix });
        items.push({ label: pathname.includes('/new/') ? 'Novo' : 'Editar' });
      } else {
        items.push({ label: section.label });
      }
      return items;
    }
  }

  if (pathname === '/admin' || pathname === '/admin/') {
    items.push({ label: 'Administração' });
    return items;
  }

  if (pathname.startsWith('/admin')) {
    items.push({ label: 'Administração' });
    return items;
  }

  if (pathname.startsWith('/profile')) {
    items.push({ label: 'Perfil' });
    return items;
  }

  return items;
}
