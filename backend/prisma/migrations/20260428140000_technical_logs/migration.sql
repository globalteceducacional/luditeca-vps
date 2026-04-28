CREATE TABLE "technical_logs" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "level" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "message" VARCHAR(500) NOT NULL,
    "metadata" JSONB,
    "request_id" VARCHAR(64),
    "route" VARCHAR(512),
    "method" VARCHAR(16),
    "status_code" INTEGER,
    "duration_ms" INTEGER,
    "user_id" TEXT,
    "ip" TEXT,
    "user_agent" VARCHAR(500),
    CONSTRAINT "technical_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "technical_logs_created_at_idx" ON "technical_logs"("created_at");
CREATE INDEX "technical_logs_category_idx" ON "technical_logs"("category");
CREATE INDEX "technical_logs_level_idx" ON "technical_logs"("level");
