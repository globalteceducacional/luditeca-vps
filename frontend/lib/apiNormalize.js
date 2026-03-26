export function normalizeBook(b) {
  if (!b) return b;
  const authors = b.authors || null;
  return {
    id: String(b.id),
    title: b.title,
    author: b.author,
    description: b.description,
    cover_image: b.coverImage ?? null,
    pages: b.pages,
    pages_v2: b.pagesV2 ?? b.pages_v2 ?? null,
    needs_migration: Boolean(b.needsMigration),
    pages_v2_suggested: b.pages_v2_suggested ?? null,
    created_at: b.createdAt,
    author_id: b.authorId != null ? String(b.authorId) : null,
    category_id: b.categoryId != null ? String(b.categoryId) : null,
    link_slidebook: b.linkSlidebook ?? null,
    authors: authors ? { id: authors.id, name: authors.name } : null,
  };
}

export function normalizeAuthor(a) {
  if (!a) return a;
  return {
    id: String(a.id),
    name: a.name,
    bio: a.bio,
    photo_url: a.photoUrl ?? null,
    created_at: a.createdAt,
  };
}

export function normalizeCategory(c) {
  if (!c) return c;
  return {
    id: String(c.id),
    name: c.name,
    image_url: c.imageUrl ?? null,
    created_at: c.createdAt,
  };
}
