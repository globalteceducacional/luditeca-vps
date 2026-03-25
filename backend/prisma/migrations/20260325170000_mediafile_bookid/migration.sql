ALTER TABLE "media_files" ADD COLUMN IF NOT EXISTS "book_id" BIGINT;

DO $$
BEGIN
  ALTER TABLE "media_files"
    ADD CONSTRAINT "media_files_book_id_fkey"
    FOREIGN KEY ("book_id") REFERENCES "books"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE INDEX IF NOT EXISTS "media_files_book_id_idx" ON "media_files"("book_id");

