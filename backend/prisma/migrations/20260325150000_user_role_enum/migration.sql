DO $$
BEGIN
  CREATE TYPE "UserRole" AS ENUM ('admin', 'editor', 'professor', 'aluno');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

UPDATE "users"
SET "role" = 'editor'
WHERE "role" NOT IN ('admin', 'editor', 'professor', 'aluno');

ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "UserRole" USING ("role"::"UserRole");
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'editor';

UPDATE "profiles"
SET "role" = 'aluno'
WHERE "role" NOT IN ('admin', 'editor', 'professor', 'aluno');

ALTER TABLE "profiles" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "profiles" ALTER COLUMN "role" TYPE "UserRole" USING ("role"::"UserRole");
ALTER TABLE "profiles" ALTER COLUMN "role" SET DEFAULT 'aluno';

