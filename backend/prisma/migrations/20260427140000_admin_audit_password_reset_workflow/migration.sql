-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "BookWorkflowStatus" AS ENUM ('draft', 'review', 'published', 'archived');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- AlterTable
ALTER TABLE "books" ADD COLUMN "workflow_status" "BookWorkflowStatus" NOT NULL DEFAULT 'draft';

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "password_reset_tokens_token_hash_idx" ON "password_reset_tokens"("token_hash");
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");

ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "admin_audit_logs" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_user_id" TEXT,
    "action_code" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "target_type" TEXT,
    "target_id" TEXT,
    "book_id" BIGINT,
    "page_ref" TEXT,
    "metadata" JSONB,
    "ip" TEXT,
    "user_agent" TEXT,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "admin_audit_logs_created_at_idx" ON "admin_audit_logs"("created_at");
CREATE INDEX "admin_audit_logs_actor_user_id_idx" ON "admin_audit_logs"("actor_user_id");
CREATE INDEX "admin_audit_logs_book_id_idx" ON "admin_audit_logs"("book_id");
CREATE INDEX "admin_audit_logs_action_code_idx" ON "admin_audit_logs"("action_code");
