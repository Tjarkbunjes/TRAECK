-- Budget & Spending Tracker tables
-- Run this migration in Supabase SQL Editor

-- 1. Credit card transactions (imported via CSV directly into Supabase)
CREATE TABLE credit_card_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  transaction_date date NOT NULL,
  booking_date date NOT NULL,
  amount numeric NOT NULL,
  currency text DEFAULT 'EUR',
  merchant text NOT NULL,
  description text,
  category text,
  booking_reference text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, booking_reference)
);

ALTER TABLE credit_card_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own transactions"
  ON credit_card_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own transactions"
  ON credit_card_transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own transactions"
  ON credit_card_transactions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own transactions"
  ON credit_card_transactions FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_cct_user_date ON credit_card_transactions(user_id, transaction_date);
CREATE INDEX idx_cct_user_category ON credit_card_transactions(user_id, category);

-- 2. Monthly budgets
CREATE TABLE monthly_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  month text NOT NULL,
  budget_amount numeric NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, month)
);

ALTER TABLE monthly_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own budgets"
  ON monthly_budgets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own budgets"
  ON monthly_budgets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own budgets"
  ON monthly_budgets FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own budgets"
  ON monthly_budgets FOR DELETE
  USING (auth.uid() = user_id);
