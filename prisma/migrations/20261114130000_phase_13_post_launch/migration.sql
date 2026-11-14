-- CreateTable
CREATE TABLE "user_passes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "tier" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "valid_from" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_until" TIMESTAMPTZ(6) NOT NULL,
    "external_id" TEXT,
    "amount_cents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_passes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "idempotency_key" TEXT NOT NULL,
    "gateway" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "preparation_targets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "requirement_id" UUID NOT NULL,
    "company" TEXT NOT NULL,
    "target_date" DATE NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "preparation_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_commitments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "target" INTEGER NOT NULL,
    "start_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rest_days_allowed" SMALLINT NOT NULL DEFAULT 1,
    "rest_day_used" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'active',
    "days_done" SMALLINT NOT NULL DEFAULT 0,
    "minutes_done" INTEGER NOT NULL DEFAULT 0,
    "ended_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_commitments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practice_days" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "active_seconds" INTEGER NOT NULL DEFAULT 0,
    "questions_answered" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "practice_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_scores" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "assessment_name" TEXT NOT NULL,
    "taken_at" DATE NOT NULL,
    "total_score" DOUBLE PRECISION NOT NULL,
    "max_score" DOUBLE PRECISION NOT NULL,
    "percentile" DOUBLE PRECISION,
    "section_scores" JSONB,
    "reliability" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "external_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pattern_reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "assessment_id" UUID,
    "company" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "claim" JSONB NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pattern_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pattern_drift_alerts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "topic_id" TEXT,
    "old_weight" DOUBLE PRECISION NOT NULL,
    "new_weight" DOUBLE PRECISION NOT NULL,
    "detected_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'open',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pattern_drift_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "opt_in_reminders" BOOLEAN NOT NULL DEFAULT false,
    "opt_in_weekly_summary" BOOLEAN NOT NULL DEFAULT false,
    "daily_limit" SMALLINT NOT NULL DEFAULT 1,
    "preferred_hour_utc" SMALLINT NOT NULL DEFAULT 14,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_passes_user_id_status_idx" ON "user_passes"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "billing_events_idempotency_key_key" ON "billing_events"("idempotency_key");

-- CreateIndex
CREATE INDEX "billing_events_idempotency_key_idx" ON "billing_events"("idempotency_key");

-- CreateIndex
CREATE INDEX "preparation_targets_requirement_id_idx" ON "preparation_targets"("requirement_id");

-- CreateIndex
CREATE INDEX "user_commitments_user_id_status_idx" ON "user_commitments"("user_id", "status");

-- CreateIndex
CREATE INDEX "practice_days_user_id_date_idx" ON "practice_days"("user_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "practice_days_user_id_date_key" ON "practice_days"("user_id", "date");

-- CreateIndex
CREATE INDEX "external_scores_user_id_taken_at_idx" ON "external_scores"("user_id", "taken_at");

-- CreateIndex
CREATE INDEX "pattern_reports_user_id_idx" ON "pattern_reports"("user_id");

-- CreateIndex
CREATE INDEX "pattern_reports_company_status_idx" ON "pattern_reports"("company", "status");

-- CreateIndex
CREATE INDEX "pattern_drift_alerts_company_status_idx" ON "pattern_drift_alerts"("company", "status");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_user_id_key" ON "notification_preferences"("user_id");

-- AddForeignKey
ALTER TABLE "user_passes" ADD CONSTRAINT "user_passes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preparation_targets" ADD CONSTRAINT "preparation_targets_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "preparation_requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_commitments" ADD CONSTRAINT "user_commitments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_days" ADD CONSTRAINT "practice_days_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_scores" ADD CONSTRAINT "external_scores_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pattern_reports" ADD CONSTRAINT "pattern_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
