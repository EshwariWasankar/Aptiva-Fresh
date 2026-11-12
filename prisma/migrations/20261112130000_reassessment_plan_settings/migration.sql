CREATE TABLE reassessment_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL UNIQUE REFERENCES practice_sessions(id) ON DELETE CASCADE,
  baseline_snapshot_id UUID NOT NULL REFERENCES profile_snapshots(id),
  comparison JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE users ADD COLUMN plan_settings JSONB NOT NULL DEFAULT '{}'::jsonb;
