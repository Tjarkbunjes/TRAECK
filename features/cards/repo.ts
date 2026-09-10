// Local-first writes for the cards module. Every mutation goes
//   IndexedDB (Dexie) → outbox → requestSync() → Supabase
// and returns as soon as the local write is done, so the UI never waits on
// the network. Callers always pass complete rows with user_id set.

import { db } from '@/lib/db';
import type { Card, CardState, Deck, Review, SchemaMode } from './types';
import { enqueue } from './sync/outbox';
import { emitCardsChanged, requestSync } from './sync/syncWorker';
import { descendantIds } from './model/decks';
import { variantsForCard } from './model/variants';

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

/**
 * Soft-deletes the deck, every live sub-deck and all their cards in one
 * transaction, so the deletion syncs like any other edit. Scheduling state
 * stays; it is ignored while the card is deleted and reused on restore.
 */
export async function softDeleteDeck(id: string): Promise<void> {
  const ts = nowIso();
  const root = await db.decks.get(id);
  if (!root) return;
  const all = await db.decks.where('user_id').equals(root.user_id).toArray();
  const ids = descendantIds(all, id);

  await db.transaction('rw', db.decks, db.cards, db.pendingSync, async () => {
    for (const deckId of ids) {
      const deck = await db.decks.get(deckId);
      if (!deck || deck.deleted_at !== null) continue;
      await db.decks.put({ ...deck, deleted_at: ts, updated_at: ts });
      await enqueue('decks', 'update', { id: deckId });

      const cards = await db.cards.where('deck_id').equals(deckId).toArray();
      for (const card of cards) {
        if (card.deleted_at !== null) continue;
        await db.cards.put({ ...card, deleted_at: ts, updated_at: ts } as Card);
        await enqueue('cards', 'update', { id: card.id });
      }
    }
  });
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

export function newCardState(card: Pick<Card, 'id' | 'user_id'>, variant: string): CardState {
  const ts = nowIso();
  return {
    card_id: card.id,
    variant,
    user_id: card.user_id,
    due: ts,
    stability: 0,
    difficulty: 0,
    elapsed_days: 0,
    scheduled_days: 0,
    reps: 0,
    lapses: 0,
    state: 0,
    last_review: null,
    suspended: false,
    leech: false,
    updated_at: ts,
  };
}

/**
 * Save a card and reconcile its card_state rows with the variants it now has:
 * missing variants get a fresh "new" state, variants that disappeared (a
 * removed cloze gap, a schema switched to whole) are deleted.
 */
export async function saveCard(card: Card, schemaMode: SchemaMode = 'whole'): Promise<Card> {
  const row = { ...card, updated_at: nowIso() } as Card;
  const wanted = new Set(variantsForCard(row, schemaMode));

  await db.transaction('rw', db.cards, db.card_state, db.pendingSync, async () => {
    await db.cards.put(row);
    await enqueue('cards', 'update', { id: row.id });

    const existing = await db.card_state.where('card_id').equals(row.id).toArray();
    const have = new Set(existing.map((s) => s.variant));

    for (const variant of wanted) {
      if (have.has(variant)) continue;
      await db.card_state.put(newCardState(row, variant));
      await enqueue('card_state', 'insert', { card_id: row.id, variant });
    }
    for (const s of existing) {
      if (wanted.has(s.variant)) continue;
      await db.card_state.delete([s.card_id, s.variant]);
      await enqueue('card_state', 'delete', { card_id: s.card_id, variant: s.variant });
    }
  });
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

export async function restoreCard(id: string): Promise<void> {
  const existing = await db.cards.get(id);
  if (!existing) return;
  await db.cards.put({ ...existing, deleted_at: null, updated_at: nowIso() } as Card);
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

/** Suspend / unsuspend every variant of a card. */
export async function setCardSuspended(cardId: string, suspended: boolean): Promise<void> {
  const ts = nowIso();
  const states = await db.card_state.where('card_id').equals(cardId).toArray();
  await db.transaction('rw', db.card_state, db.pendingSync, async () => {
    for (const s of states) {
      if (s.suspended === suspended) continue;
      await db.card_state.put({ ...s, suspended, updated_at: ts });
      await enqueue('card_state', 'update', { card_id: s.card_id, variant: s.variant });
    }
  });
  afterWrite();
}

// ── reviews ──────────────────────────────────────────────────────────────────

export async function addReview(review: Review): Promise<Review> {
  await db.reviews.put(review);
  await enqueue('reviews', 'insert', { id: review.id });
  afterWrite();
  return review;
}
