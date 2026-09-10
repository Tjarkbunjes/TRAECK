-- Cards module (spaced-repetition flashcards): decks, cards, card_state, reviews
-- plus the profiles.settings jsonb container used for profiles.settings.cards.
-- Run this migration in Supabase SQL Editor

-- ── profiles.settings ─────────────────────────────────────────────────────────
-- Generic per-user settings container. The cards module writes only the
-- `cards` subtree; other modules may add their own keys later.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ── decks ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS decks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  parent_id uuid REFERENCES decks(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  color text,
  icon text,
  position int NOT NULL DEFAULT 0,
  fsrs_params jsonb,
  daily_new_limit int NOT NULL DEFAULT 20,
  daily_review_limit int NOT NULL DEFAULT 200,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE decks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own decks"
  ON decks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own decks"
  ON decks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own decks"
  ON decks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own decks"
  ON decks FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_decks_user_parent ON decks(user_id, parent_id);
CREATE INDEX IF NOT EXISTS idx_decks_user_updated ON decks(user_id, updated_at);

-- ── cards ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  deck_id uuid REFERENCES decks(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL CHECK (type IN ('basic', 'reverse', 'cloze', 'schema', 'streitstand')),
  fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  tags text[] NOT NULL DEFAULT '{}',
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

ALTER TABLE cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own cards"
  ON cards FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own cards"
  ON cards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own cards"
  ON cards FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own cards"
  ON cards FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_cards_user_deck ON cards(user_id, deck_id);
CREATE INDEX IF NOT EXISTS idx_cards_user_updated ON cards(user_id, updated_at);

-- ── card_state ────────────────────────────────────────────────────────────────
-- One scheduling state per learnable variant of a card:
--   basic/schema/streitstand → 'fwd'
--   reverse                  → 'fwd' + 'rev'
--   cloze                    → 'c1', 'c2', … (one per gap)
-- updated_at drives last-writer-wins sync, same as decks/cards.
CREATE TABLE IF NOT EXISTS card_state (
  card_id uuid REFERENCES cards(id) ON DELETE CASCADE NOT NULL,
  variant text NOT NULL DEFAULT 'fwd',
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  due timestamptz NOT NULL DEFAULT now(),
  stability double precision NOT NULL DEFAULT 0,
  difficulty double precision NOT NULL DEFAULT 0,
  elapsed_days int NOT NULL DEFAULT 0,
  scheduled_days int NOT NULL DEFAULT 0,
  reps int NOT NULL DEFAULT 0,
  lapses int NOT NULL DEFAULT 0,
  state int NOT NULL DEFAULT 0 CHECK (state BETWEEN 0 AND 3),
  last_review timestamptz,
  suspended boolean NOT NULL DEFAULT false,
  leech boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (card_id, variant)
);

ALTER TABLE card_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own card_state"
  ON card_state FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own card_state"
  ON card_state FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own card_state"
  ON card_state FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own card_state"
  ON card_state FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_card_state_user_due ON card_state(user_id, due);
CREATE INDEX IF NOT EXISTS idx_card_state_user_updated ON card_state(user_id, updated_at);

-- ── reviews ───────────────────────────────────────────────────────────────────
-- Append-only review log. Rows are never updated; sync pulls by reviewed_at.
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  card_id uuid REFERENCES cards(id) ON DELETE CASCADE NOT NULL,
  variant text NOT NULL DEFAULT 'fwd',
  deck_id uuid REFERENCES decks(id) ON DELETE CASCADE NOT NULL,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 4),
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  duration_ms int NOT NULL DEFAULT 0,
  state_before int NOT NULL CHECK (state_before BETWEEN 0 AND 3),
  stability_before double precision NOT NULL DEFAULT 0,
  scheduled_days int NOT NULL DEFAULT 0
);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own reviews"
  ON reviews FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own reviews"
  ON reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own reviews"
  ON reviews FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own reviews"
  ON reviews FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_reviews_user_reviewed ON reviews(user_id, reviewed_at);
CREATE INDEX IF NOT EXISTS idx_reviews_user_card ON reviews(user_id, card_id);
