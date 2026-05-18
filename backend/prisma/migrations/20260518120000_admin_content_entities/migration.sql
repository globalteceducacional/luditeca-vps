-- Sprint 0 — entidades de conteúdo admin (Activity, LIBRAS, Puzzle, Coloring)

CREATE TABLE "activities" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "type" TEXT NOT NULL,
    "questions" JSONB NOT NULL DEFAULT '[]',
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "badge_reward" TEXT,
    "book_id" BIGINT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "libras_lessons" (
    "id" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "category" TEXT,
    "image_url" TEXT,
    "description" TEXT,
    "quiz_question" TEXT,
    "quiz_options" JSONB,
    "quiz_correct" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "libras_lessons_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "puzzle_games" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "image_url" TEXT NOT NULL,
    "piece_count" INTEGER NOT NULL DEFAULT 15,
    "caption" TEXT,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "puzzle_games_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "coloring_pages" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "image_url" TEXT,
    "default_id" TEXT,
    "svg_type" TEXT,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coloring_pages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "activities_is_published_idx" ON "activities"("is_published");
CREATE INDEX "activities_book_id_idx" ON "activities"("book_id");
CREATE INDEX "libras_lessons_sort_order_idx" ON "libras_lessons"("sort_order");
CREATE INDEX "puzzle_games_is_published_idx" ON "puzzle_games"("is_published");
CREATE INDEX "coloring_pages_is_published_idx" ON "coloring_pages"("is_published");
CREATE INDEX "coloring_pages_default_id_idx" ON "coloring_pages"("default_id");

ALTER TABLE "activities" ADD CONSTRAINT "activities_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE SET NULL ON UPDATE CASCADE;
