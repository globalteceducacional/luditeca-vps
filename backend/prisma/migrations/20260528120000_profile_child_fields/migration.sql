-- Campos de perfil infantil: idade, avatar predefinido, XP e badges
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "age" INTEGER;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "avatar_id" TEXT;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "xp_total" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "xp_balance" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "badges" JSONB DEFAULT '[]'::jsonb;

-- Sincroniza XP inicial a partir de livros já lidos
UPDATE "profiles"
SET
  "xp_total" = GREATEST("xp_total", COALESCE("books_read", 0)::integer * 100),
  "xp_balance" = GREATEST("xp_balance", COALESCE("books_read", 0)::integer * 100)
WHERE COALESCE("books_read", 0) > 0;
