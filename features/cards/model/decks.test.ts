import { describe, it, expect } from 'vitest';
import type { Deck } from '../types';
import { buildDeckTree, deckPath, descendantIds, flattenTree, possibleParents, sortDecks } from './decks';

function deck(id: string, parent: string | null, position = 0, extra: Partial<Deck> = {}): Deck {
  return {
    id,
    user_id: 'u',
    parent_id: parent,
    name: id,
    description: null,
    color: null,
    icon: null,
    position,
    fsrs_params: null,
    daily_new_limit: 20,
    daily_review_limit: 200,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    deleted_at: null,
    ...extra,
  };
}

const decks: Deck[] = [
  deck('zivil', null, 1),
  deck('straf', null, 0),
  deck('bgb-at', 'zivil', 1),
  deck('schuldrecht', 'zivil', 0),
  deck('willenserklaerung', 'bgb-at'),
  deck('alt', 'zivil', 0, { deleted_at: '2026-02-01T00:00:00Z' }),
  deck('orphan', 'ghost'),
];

describe('buildDeckTree', () => {
  it('nests by parent_id, sorts by position then name, and skips deleted decks', () => {
    const tree = buildDeckTree(decks);
    expect(tree.map((n) => n.deck.id)).toEqual(['orphan', 'straf', 'zivil']);
    const zivil = tree[2];
    expect(zivil.children.map((n) => n.deck.id)).toEqual(['schuldrecht', 'bgb-at']);
    expect(zivil.children[1].children[0].deck.id).toBe('willenserklaerung');
    expect(zivil.children[1].children[0].depth).toBe(2);
  });

  it('treats a deck with a missing parent as a root', () => {
    expect(buildDeckTree(decks).some((n) => n.deck.id === 'orphan')).toBe(true);
  });

  it('survives a parent cycle', () => {
    const cyc = [deck('a', 'b'), deck('b', 'a')];
    expect(buildDeckTree(cyc)).toEqual([]);
    expect(descendantIds(cyc, 'a')).toEqual(['a', 'b']);
  });

  it('flattens depth-first', () => {
    expect(flattenTree(buildDeckTree(decks)).map((n) => n.deck.id)).toEqual([
      'orphan', 'straf', 'zivil', 'schuldrecht', 'bgb-at', 'willenserklaerung',
    ]);
  });
});

describe('descendantIds / deckPath / possibleParents', () => {
  it('includes self and all live descendants', () => {
    expect(descendantIds(decks, 'zivil')).toEqual(['zivil', 'bgb-at', 'willenserklaerung', 'schuldrecht']);
    expect(descendantIds(decks, 'straf')).toEqual(['straf']);
  });

  it('builds the path root → deck', () => {
    expect(deckPath(decks, 'willenserklaerung').map((d) => d.id)).toEqual(['zivil', 'bgb-at', 'willenserklaerung']);
    expect(deckPath(decks, 'orphan').map((d) => d.id)).toEqual(['orphan']);
    expect(deckPath(decks, 'alt')).toEqual([]);
  });

  it('excludes self and descendants from possible parents', () => {
    expect(possibleParents(decks, 'zivil').map((d) => d.id)).toEqual(['orphan', 'straf']);
    expect(possibleParents(decks, null).map((d) => d.id)).toEqual(['orphan', 'schuldrecht', 'straf', 'willenserklaerung', 'bgb-at', 'zivil']);
  });

  it('sortDecks does not mutate', () => {
    const input = [deck('b', null, 1), deck('a', null, 1)];
    const sorted = sortDecks(input);
    expect(sorted.map((d) => d.id)).toEqual(['a', 'b']);
    expect(input.map((d) => d.id)).toEqual(['b', 'a']);
  });
});
