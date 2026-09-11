'use client';

import { useMemo } from 'react';
import { db } from '@/lib/db';
import { useAuth } from '@/lib/hooks';
import type { Deck } from '../types';
import { buildDeckTree, isLiveDeck, type DeckNode } from '../model/decks';
import { useDexieQuery } from './useDexieQuery';

export interface DeckCounts {
  total: number;
  due: number;
  new: number;
  suspended: number;
  leech: number;
}

const EMPTY_COUNTS: DeckCounts = { total: 0, due: 0, new: 0, suspended: 0, leech: 0 };

/** Card counts per deck (own cards only, no sub-decks). Deleted cards are excluded. */
async function countsByDeck(userId: string): Promise<Map<string, DeckCounts>> {
  const now = new Date().toISOString();
  const [cards, states] = await Promise.all([
    db.cards.where('user_id').equals(userId).toArray(),
    db.card_state.where('user_id').equals(userId).toArray(),
  ]);
  const deckOfCard = new Map<string, string>();
  for (const c of cards) if (c.deleted_at === null) deckOfCard.set(c.id, c.deck_id);

  const out = new Map<string, DeckCounts>();
  const bump = (deckId: string, key: keyof DeckCounts) => {
    const c = out.get(deckId) ?? { ...EMPTY_COUNTS };
    c[key] += 1;
    out.set(deckId, c);
  };
  for (const [, deckId] of deckOfCard) bump(deckId, 'total');
  for (const s of states) {
    const deckId = deckOfCard.get(s.card_id);
    if (!deckId) continue;
    if (s.suspended) {
      bump(deckId, 'suspended');
      continue;
    }
    if (s.leech) bump(deckId, 'leech');
    if (s.state === 0) bump(deckId, 'new');
    else if (s.due <= now) bump(deckId, 'due');
  }
  return out;
}

export function useDecks() {
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const { data, loading } = useDexieQuery(async () => {
    if (!uid) return { decks: [] as Deck[], counts: new Map<string, DeckCounts>() };
    const [decks, counts] = await Promise.all([
      db.decks.where('user_id').equals(uid).toArray(),
      countsByDeck(uid),
    ]);
    return { decks, counts };
  }, [uid]);

  const decks = useMemo(() => data?.decks ?? [], [data]);
  const liveDecks = useMemo(() => decks.filter(isLiveDeck), [decks]);
  const tree = useMemo(() => buildDeckTree(decks), [decks]);
  const counts = useMemo(() => data?.counts ?? new Map<string, DeckCounts>(), [data]);

  /** Counts including all sub-decks. */
  const countsWithChildren = useMemo(() => {
    const out = new Map<string, DeckCounts>();
    const walk = (node: DeckNode): DeckCounts => {
      const own = counts.get(node.deck.id) ?? EMPTY_COUNTS;
      const sum = { ...own };
      for (const child of node.children) {
        const c = walk(child);
        sum.total += c.total;
        sum.due += c.due;
        sum.new += c.new;
        sum.suspended += c.suspended;
        sum.leech += c.leech;
      }
      out.set(node.deck.id, sum);
      return sum;
    };
    tree.forEach(walk);
    return out;
  }, [tree, counts]);

  return { decks, liveDecks, tree, counts, countsWithChildren, loading: loading || !uid, userId: uid };
}

export function useDeck(id: string | null) {
  const { data, loading } = useDexieQuery(async () => (id ? db.decks.get(id) : undefined), [id]);
  return { deck: data && data.deleted_at === null ? data : null, loading };
}
