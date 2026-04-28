function asStringArray(v) {
  if (!Array.isArray(v)) return [];
  return v.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim());
}

export function normalizeBook(b) {
  if (!b) return b;
  const authors = b.authors || null;
  const category = b.category || null;
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
    workflow_status: b.workflowStatus ?? b.workflow_status ?? 'draft',
    authors: authors ? { id: String(authors.id), name: authors.name } : null,
    category: category ? { id: String(category.id), name: category.name } : null,
    catalog_characters: asStringArray(b.catalogCharacters ?? b.catalog_characters),
    catalog_keywords: asStringArray(b.catalogKeywords ?? b.catalog_keywords),
    catalog_collection: b.catalogCollection ?? b.catalog_collection ?? '',
    catalog_level: b.catalogLevel ?? b.catalog_level ?? '',
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
