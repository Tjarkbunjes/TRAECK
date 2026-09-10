// Local-first writes for the cards module. Every mutation goes
//   IndexedDB (Dexie) → outbox → requestSync() → Supabase
// and returns as soon as the local write is done, so the UI never waits on
// the network. Callers always pass complete rows with user_id set.

import { db } from '@/lib/db';
import type { Card, CardState, Deck, Review } from './types';
import { enqueue } from './sync/outbox';
import { emitCardsChanged, requestSync } from './sync/syncWorker';

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(): string {
  return crypto.randomUUID();
}

function afterWrite(): void {
  emitCardsChanged();
  void requestSync();
}

// ── decks ────────────────────────────────────────────────────────────────────

export async function putDeck(deck: Deck): Promise<Deck> {
  const row = { ...deck, updated_at: nowIso() };
  await db.decks.put(row);
  await enqueue('decks', 'update', { id: row.id });
  afterWrite();
  return row;
}

export async function deleteDeck(id: string): Promise<void> {
  await db.decks.delete(id);
  await enqueue('decks', 'delete', { id });
  afterWrite();
}

// ── cards ────────────────────────────────────────────────────────────────────

export async function putCard(card: Card): Promise<Card> {
  const row = { ...card, updated_at: nowIso() } as Card;
  await db.cards.put(row);
  await enqueue('cards', 'update', { id: row.id });
  afterWrite();
  return row;
}

/** Cards are soft-deleted (deleted_at) so the deletion syncs like any other edit. */
export async function softDeleteCard(id: string): Promise<void> {
  const existing = await db.cards.get(id);
  if (!existing) return;
  const ts = nowIso();
  await db.cards.put({ ...existing, deleted_at: ts, updated_at: ts } as Card);
  await enqueue('cards', 'update', { id });
  afterWrite();
}

// ── card_state ───────────────────────────────────────────────────────────────

export async function putCardState(cardState: CardState): Promise<CardState> {
  const row = { ...cardState, updated_at: nowIso() };
  await db.card_state.put(row);
  await enqueue('card_state', 'update', { card_id: row.card_id, variant: row.variant });
  afterWrite();
  return row;
}

// ── reviews ──────────────────────────────────────────────────────────────────

export async function addReview(review: Review): Promise<Review> {
  await db.reviews.put(review);
  await enqueue('reviews', 'insert', { id: review.id });
  afterWrite();
  return review;
}
