-- Journal entries table
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS journal_entries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date date NOT NULL,

  hours_slept numeric(4,1),
  sleep_quality int CHECK (sleep_quality BETWEEN 1 AND 5),
  sweets boolean,
  last_meal_time text,
  alcohol boolean,
  alcohol_amount int CHECK (alcohol_amount BETWEEN 1 AND 5),
  sex boolean,
  magnesium_zinc boolean,

  created_at timestamptz DEFAULT now(),

  UNIQUE(user_id, date)
);

ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own journal entries"
  ON journal_entries FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
