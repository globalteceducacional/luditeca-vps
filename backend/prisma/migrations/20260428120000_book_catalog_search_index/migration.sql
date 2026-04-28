-- Catálogo: metadados de busca + índice denormalizado
ALTER TABLE "books" ADD COLUMN IF NOT EXISTS "catalog_characters" JSONB;
ALTER TABLE "books" ADD COLUMN IF NOT EXISTS "catalog_collection" TEXT;
ALTER TABLE "books" ADD COLUMN IF NOT EXISTS "catalog_keywords" JSONB;
ALTER TABLE "books" ADD COLUMN IF NOT EXISTS "catalog_level" TEXT;
ALTER TABLE "books" ADD COLUMN IF NOT EXISTS "search_index" TEXT NOT NULL DEFAULT '';

-- Preenchimento inicial a partir de título e descrição (personagens/palavras vazios)
UPDATE "books"
SET "search_index" = lower(trim(coalesce("title", '') || ' ' || coalesce("description", '')))
WHERE coalesce(trim("search_index"), '') = '';

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "books_search_index_trgm_idx" ON "books" USING gin ("search_index" gin_trgm_ops);
