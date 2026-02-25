-- Journal entries v2: add behavioral/subjective fields for ML driver analysis
-- Run this in your Supabase SQL Editor

ALTER TABLE journal_entries
  ADD COLUMN IF NOT EXISTS caffeine boolean,
  ADD COLUMN IF NOT EXISTS caffeine_amount int CHECK (caffeine_amount BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS stress_level int CHECK (stress_level BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS screen_before_bed boolean,
  ADD COLUMN IF NOT EXISTS mood int CHECK (mood BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS energy_level int CHECK (energy_level BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS hydration int CHECK (hydration BETWEEN 1 AND 3);
