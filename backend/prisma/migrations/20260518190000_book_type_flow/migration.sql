-- Fluxo de criação por tipo (paridade Base44: animated | interactive | digital)

CREATE TYPE "BookType" AS ENUM ('animated', 'interactive', 'digital');

ALTER TABLE "books"
  ADD COLUMN "book_type" "BookType",
  ADD COLUMN "age_range" TEXT,
  ADD COLUMN "book_quiz" JSONB,
  ADD COLUMN "soundtrack_url" TEXT,
  ADD COLUMN "pdf_url" TEXT,
  ADD COLUMN "epub_url" TEXT,
  ADD COLUMN "is_pdf" BOOLEAN NOT NULL DEFAULT false;
