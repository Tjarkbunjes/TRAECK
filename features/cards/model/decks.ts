// Pure deck-tree helpers. Decks form a forest via parent_id (any depth);
// soft-deleted decks are excluded everywhere, and a live deck whose parent is
// missing or deleted is treated as a root so nothing silently disappears.

import type { Deck } from '../types';

export interface DeckNode {
  deck: Deck;
  children: DeckNode[];
  depth: number;
}

export function isLiveDeck(deck: Deck): boolean {
  return deck.deleted_at === null;
}

export function sortDecks<T extends Pick<Deck, 'position' | 'name'>>(decks: T[]): T[] {
  return [...decks].sort((a, b) => a.position - b.position || a.name.localeCompare(b.name, 'de'));
}

export function buildDeckTree(decks: Deck[]): DeckNode[] {
  const live = decks.filter(isLiveDeck);
  const ids = new Set(live.map((d) => d.id));
  const byParent = new Map<string | null, Deck[]>();
  for (const d of live) {
    const parent = d.parent_id !== null && ids.has(d.parent_id) ? d.parent_id : null;
    const list = byParent.get(parent) ?? [];
    list.push(d);
    byParent.set(parent, list);
  }
  const build = (parent: string | null, depth: number, seen: Set<string>): DeckNode[] =>
    sortDecks(byParent.get(parent) ?? [])
      .filter((d) => !seen.has(d.id)) // guards against parent cycles from bad data
      .map((d) => {
        const next = new Set(seen).add(d.id);
        return { deck: d, depth, children: build(d.id, depth + 1, next) };
      });
  return build(null, 0, new Set());
}

export function flattenTree(nodes: DeckNode[]): DeckNode[] {
  const out: DeckNode[] = [];
  const walk = (list: DeckNode[]) => {
    for (const n of list) {
      out.push(n);
      walk(n.children);
    }
  };
  walk(nodes);
  return out;
}

/** The deck itself plus every live descendant, depth-first. */
export function descendantIds(decks: Deck[], id: string): string[] {
  const live = decks.filter(isLiveDeck);
  const out: string[] = [];
  const seen = new Set<string>();
  const walk = (current: string) => {
    if (seen.has(current)) return;
    seen.add(current);
    out.push(current);
    for (const d of live) if (d.parent_id === current) walk(d.id);
  };
  walk(id);
  return out;
}

/** Root → … → deck. Stops at a missing or deleted ancestor. */
export function deckPath(decks: Deck[], id: string): Deck[] {
  const byId = new Map(decks.filter(isLiveDeck).map((d) => [d.id, d] as const));
  const path: Deck[] = [];
  const seen = new Set<string>();
  let current = byId.get(id);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    path.unshift(current);
    current = current.parent_id !== null ? byId.get(current.parent_id) : undefined;
  }
  return path;
}

/** Decks that may become the parent of `id`: everything except itself and its descendants. */
export function possibleParents(decks: Deck[], id: string | null): Deck[] {
  const excluded = new Set(id ? descendantIds(decks, id) : []);
  return sortDecks(decks.filter((d) => isLiveDeck(d) && !excluded.has(d.id)));
}
