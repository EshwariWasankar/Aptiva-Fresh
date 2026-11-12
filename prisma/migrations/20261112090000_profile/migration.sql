-- PH-6: student_topic_profiles + profile_snapshots (playbook 12.1 DDL)
CREATE TABLE student_topic_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES topics(id),
  rating REAL NOT NULL DEFAULT 1000,
  rd REAL NOT NULL DEFAULT 350,
  accuracy_ema REAL,
  time_ema_ms REAL,
  attempt_count INT NOT NULL DEFAULT 0,
  error_mix JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, topic_id)
);

CREATE TABLE profile_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trigger TEXT NOT NULL CHECK (trigger IN ('baseline','session','reassessment','edit')),
  is_baseline BOOLEAN NOT NULL DEFAULT FALSE,
  data JSONB NOT NULL,
  engine_version TEXT NOT NULL,
  taken_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_profile_snapshots_user ON profile_snapshots (user_id, taken_at DESC);
