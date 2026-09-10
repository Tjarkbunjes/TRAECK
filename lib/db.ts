import Dexie, { type EntityTable, type Table } from 'dexie';
import type { Card, CardState, Deck, Review } from '@/features/cards/types';

interface RecentFood {
  id?: number;
  food_name: string;
  barcode?: string;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  last_used: number;
}

interface PendingSync {
  id?: number;
  table: string;
  action: 'insert' | 'update' | 'delete';
  data: Record<string, unknown>;
  created_at: number;
}

/** Key/value store for sync cursors and similar bookkeeping. */
interface SyncMeta {
  key: string;
  value: string;
}

const db = new Dexie('FitTrackDB') as Dexie & {
  recentFoods: EntityTable<RecentFood, 'id'>;
  pendingSync: EntityTable<PendingSync, 'id'>;
  decks: EntityTable<Deck, 'id'>;
  cards: EntityTable<Card, 'id'>;
  card_state: Table<CardState, [string, string]>;
  reviews: EntityTable<Review, 'id'>;
  syncMeta: Table<SyncMeta, string>;
};

db.version(1).stores({
  cachedProducts: 'barcode, name',
  recentFoods: '++id, food_name, last_used',
  pendingSync: '++id, table, created_at',
});

// v2: remove cachedProducts (no longer used)
db.version(2).stores({
  cachedProducts: null,
  recentFoods: '++id, food_name, last_used',
  pendingSync: '++id, table, created_at',
});

// v3: cards module — local mirror of decks/cards/card_state/reviews plus sync cursors.
// pendingSync doubles as the outbox for these tables (see features/cards/sync).
db.version(3).stores({
  recentFoods: '++id, food_name, last_used',
  pendingSync: '++id, table, created_at',
  decks: 'id, user_id, parent_id, updated_at',
  cards: 'id, user_id, deck_id, updated_at, *tags',
  card_state: '[card_id+variant], user_id, due, [user_id+due]',
  reviews: 'id, user_id, card_id, reviewed_at, [user_id+reviewed_at]',
  syncMeta: 'key',
});

export { db };
export type { RecentFood, PendingSync, SyncMeta };
