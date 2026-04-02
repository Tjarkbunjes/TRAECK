-- Manual expense tracking (hand-tracked daily spending)
-- Run this migration in Supabase SQL Editor

CREATE TABLE manual_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  date date NOT NULL,
  amount numeric NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE manual_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own manual expenses"
  ON manual_expenses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own manual expenses"
  ON manual_expenses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own manual expenses"
  ON manual_expenses FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own manual expenses"
  ON manual_expenses FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_manual_expenses_user_date ON manual_expenses(user_id, date);
