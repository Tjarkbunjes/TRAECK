-- Developer Notes / Feedback table
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS dev_notes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  note text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE dev_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own dev notes"
  ON dev_notes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own dev notes"
  ON dev_notes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
