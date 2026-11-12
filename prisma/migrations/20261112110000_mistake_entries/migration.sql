CREATE TABLE mistake_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attempt_id UUID NOT NULL UNIQUE REFERENCES question_attempts(id) ON DELETE CASCADE,
  error_type_id SMALLINT REFERENCES error_types(id),
  retry_at DATE,
  retry_count SMALLINT NOT NULL DEFAULT 0,
  resolved_at TIMESTAMPTZ
);
CREATE INDEX idx_mistake_entries_user ON mistake_entries (user_id, resolved_at);
