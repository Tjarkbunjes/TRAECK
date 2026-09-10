// Row types for the cards module. Field names mirror supabase/migration_cards.sql
// exactly (snake_case, nullables as `| null`) — same rule as lib/types.ts.

export const CARD_TYPES = ['basic', 'reverse', 'cloze', 'schema', 'streitstand'] as const;
export type CardType = (typeof CARD_TYPES)[number];

/** FSRS card state: 0 new, 1 learning, 2 review, 3 relearning */
export type CardStateValue = 0 | 1 | 2 | 3;

/** Review rating: 1 again, 2 hard, 3 good, 4 easy */
export type Rating = 1 | 2 | 3 | 4;

export interface Deck {
  id: string;
  user_id: string;
  parent_id: string | null;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  position: number;
  fsrs_params: FsrsParams | null;
  daily_new_limit: number;
  daily_review_limit: number;
  created_at: string;
  updated_at: string;
}

/** Per-deck FSRS overrides. Anything left undefined falls back to the global setting. */
export interface FsrsParams {
  request_retention?: number;
  maximum_interval?: number;
  w?: number[];
  /** schema cards: ask every step on its own or the schema as a whole */
  schema_mode?: 'steps' | 'whole';
}

// ── card fields per type ─────────────────────────────────────────────────────

export interface BasicFields {
  front: string;
  back: string;
}

export type ReverseFields = BasicFields;

export interface ClozeFields {
  /** markdown containing {{c1::…}} gaps */
  text: string;
  extra: string;
}

export interface SchemaStep {
  label: string;
  content: string;
}

export interface SchemaFields {
  title: string;
  steps: SchemaStep[];
}

export interface StreitstandAnsicht {
  name: string;
  argumente: string[];
}

export interface StreitstandFields {
  problem: string;
  ansichten: StreitstandAnsicht[];
  rechtsprechung: string;
  stellungnahme: string;
}

export interface CardFieldsByType {
  basic: BasicFields;
  reverse: ReverseFields;
  cloze: ClozeFields;
  schema: SchemaFields;
  streitstand: StreitstandFields;
}

interface CardBase {
  id: string;
  user_id: string;
  deck_id: string;
  tags: string[];
  source: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** Discriminated on `type`, so `card.fields` is typed per card type. */
export type Card = {
  [T in CardType]: CardBase & { type: T; fields: CardFieldsByType[T] };
}[CardType];

/**
 * Scheduling state for one learnable variant of a card.
 * Primary key is (card_id, variant): basic → 'fwd', reverse → 'fwd' | 'rev',
 * cloze → 'c1', 'c2', …
 */
export interface CardState {
  card_id: string;
  variant: string;
  user_id: string;
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  state: CardStateValue;
  last_review: string | null;
  suspended: boolean;
  leech: boolean;
  updated_at: string;
}

export interface Review {
  id: string;
  user_id: string;
  card_id: string;
  variant: string;
  deck_id: string;
  rating: Rating;
  reviewed_at: string;
  duration_ms: number;
  state_before: CardStateValue;
  stability_before: number;
  scheduled_days: number;
}

/** Supabase table names owned by this module. */
export const CARDS_TABLES = ['decks', 'cards', 'card_state', 'reviews'] as const;
export type CardsTable = (typeof CARDS_TABLES)[number];

export interface CardsRowByTable {
  decks: Deck;
  cards: Card;
  card_state: CardState;
  reviews: Review;
}
