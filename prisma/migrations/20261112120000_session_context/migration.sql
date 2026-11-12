ALTER TABLE practice_sessions
  ADD COLUMN topic_id UUID REFERENCES topics(id),
  ADD COLUMN block_type TEXT;
