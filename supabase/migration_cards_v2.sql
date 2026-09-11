-- Cards module v2: soft delete for decks so deletions sync across devices
-- Run this migration in Supabase SQL Editor

ALTER TABLE decks
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
