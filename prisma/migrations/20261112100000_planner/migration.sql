-- PH-7: preparation requirements, practice plans, plan items, change log, readiness estimates
CREATE TABLE preparation_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assessment_id UUID REFERENCES assessments(id),
  mode TEXT NOT NULL CHECK (mode IN ('general','assessment_specific')),
  test_date DATE NOT NULL,
  deadline_date DATE NOT NULL CHECK (deadline_date <= test_date),
  minutes_per_weekday JSONB NOT NULL,
  block_length_min SMALLINT NOT NULL,
  wanted_topics JSONB NOT NULL DEFAULT '[]',
  preparation_level TEXT,
  known_info JSONB,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  superseded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_requirements_user_active ON preparation_requirements (user_id, is_active);

CREATE TABLE practice_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requirement_id UUID NOT NULL REFERENCES preparation_requirements(id),
  snapshot_id UUID REFERENCES profile_snapshots(id),
  trigger TEXT NOT NULL CHECK (trigger IN ('setup','session','reassessment','requirements_change','restore')),
  planner_method TEXT NOT NULL CHECK (planner_method IN ('knapsack','fallback')),
  elapsed_ms INT NOT NULL,
  engine_version TEXT NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_plans_user_current ON practice_plans (user_id, is_current);

CREATE TABLE practice_plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES practice_plans(id) ON DELETE CASCADE,
  day_index SMALLINT NOT NULL,
  order_no SMALLINT NOT NULL,
  block_type TEXT NOT NULL,
  topic_id UUID NOT NULL REFERENCES topics(id),
  minutes SMALLINT NOT NULL CHECK (minutes > 0),
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  rationale JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned',
  session_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plan_id, day_index, order_no)
);
CREATE INDEX idx_plan_items_plan_day ON practice_plan_items (plan_id, day_index);

CREATE TABLE plan_change_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES practice_plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trigger TEXT NOT NULL,
  summary JSONB NOT NULL,
  restored_from UUID REFERENCES practice_plans(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_plan_changes_user ON plan_change_log (user_id, created_at DESC);

CREATE TABLE readiness_estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requirement_id UUID REFERENCES preparation_requirements(id),
  band_low NUMERIC(5,2) NOT NULL,
  band_high NUMERIC(5,2) NOT NULL,
  confidence TEXT NOT NULL CHECK (confidence IN ('low','medium','high')),
  factors JSONB NOT NULL,
  engine_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_readiness_user ON readiness_estimates (user_id, created_at DESC);
