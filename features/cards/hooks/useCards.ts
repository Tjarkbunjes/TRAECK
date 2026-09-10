'use client';

import { useMemo } from 'react';
import { db } from '@/lib/db';
import type { Card, CardState, Review } from '../types';
import { cardTitle } from '../model/variants';
import { useDexieQuery } from './useDexieQuery';

export const CARD_FILTERS = ['all', 'due', 'new', 'leech', 'suspended'] as const;
export type CardFilter = (typeof CARD_FILTERS)[number];

export const CARD_FILTER_LABELS: Record<CardFilter, string> = {
  all: 'alle',
  due: 'fällig',
  new: 'neu',
  leech: 'leech',
  suspended: 'ausgesetzt',
};

export interface CardRow {
  card: Card;
  states: CardState[];
  title: string;
  due: boolean;
  isNew: boolean;
  leech: boolean;
  suspended: boolean;
}

function toRow(card: Card, states: CardState[], now: string): CardRow {
  const active = states.filter((s) => !s.suspended);
  return {
    card,
    states,
    title: cardTitle(card),
    due: active.some((s) => s.state !== 0 && s.due <= now),
    isNew: active.some((s) => s.state === 0),
    leech: states.some((s) => s.leech),
    suspended: states.length > 0 && states.every((s) => s.suspended),
  };
}

function matches(row: CardRow, filter: CardFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'due':
      return row.due;
    case 'new':
      return row.isNew;
    case 'leech':
      return row.leech;
    case 'suspended':
      return row.suspended;
  }
}

function searchText(card: Card): string {
  const f = card.fields as unknown as Record<string, unknown>;
  const parts: string[] = [...card.tags, card.source ?? ''];
  const push = (v: unknown) => {
    if (typeof v === 'string') parts.push(v);
    else if (Array.isArray(v)) v.forEach(push);
    else if (v && typeof v === 'object') Object.values(v).forEach(push);
  };
  Object.values(f).forEach(push);
  return parts.join('\n').toLowerCase();
}

/** Live cards of one deck (no sub-decks), with search and status filter applied. */
export function useDeckCards(deckId: string | null, query: string, filter: CardFilter) {
  const { data, loading } = useDexieQuery(async () => {
    if (!deckId) return [] as CardRow[];
    const cards = (await db.cards.where('deck_id').equals(deckId).toArray()).filter((c) => c.deleted_at === null);
    const states = await db.card_state.where('card_id').anyOf(cards.map((c) => c.id)).toArray();
    const byCard = new Map<string, CardState[]>();
    for (const s of states) {
      const list = byCard.get(s.card_id) ?? [];
      list.push(s);
      byCard.set(s.card_id, list);
    }
    const now = new Date().toISOString();
    return cards
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .map((c) => toRow(c, byCard.get(c.id) ?? [], now));
  }, [deckId]);

  const rows = useMemo(() => {
    const all = data ?? [];
    const q = query.trim().toLowerCase();
    return all.filter((r) => matches(r, filter) && (!q || searchText(r.card).includes(q)));
  }, [data, query, filter]);

  return { rows, total: data?.length ?? 0, loading };
}

export function useCard(id: string | null) {
  const { data, loading } = useDexieQuery(async () => {
    if (!id) return null;
    const card = await db.cards.get(id);
    if (!card) return null;
    const [states, reviews] = await Promise.all([
      db.card_state.where('card_id').equals(id).toArray(),
      db.reviews.where('card_id').equals(id).reverse().sortBy('reviewed_at'),
    ]);
    return { card, states, reviews: reviews as Review[] };
  }, [id]);
  return { card: data?.card ?? null, states: data?.states ?? [], reviews: data?.reviews ?? [], loading };
}

/** Titles of live cards in a deck, for duplicate warnings in the editor. */
export function useDeckCardTitles(deckId: string | null) {
  const { data } = useDexieQuery(async () => {
    if (!deckId) return [] as { id: string; key: string }[];
    const cards = (await db.cards.where('deck_id').equals(deckId).toArray()).filter((c) => c.deleted_at === null);
    return cards.map((c) => ({ id: c.id, key: cardTitle(c).toLowerCase() }));
  }, [deckId]);
  return data ?? [];
}
