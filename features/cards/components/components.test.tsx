import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Card, Deck } from '../types';
import { buildDeckTree } from '../model/decks';
import { CardFace } from './CardFace';
import { CardEditor, cardFromDraft, draftFromCard, emptyDraft, validateDraft } from './CardEditor';
import { DeckTree } from './DeckTree';
import { CardList } from './CardList';
import type { CardRow } from '../hooks/useCards';

const base = { id: 'c', user_id: 'u', deck_id: 'd', tags: ['zivilrecht'], source: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', deleted_at: null };
const cards: Card[] = [
  { ...base, id: 'b', type: 'basic', fields: { front: 'Frage zu § 823 I BGB', back: 'Antwort' } },
  { ...base, id: 'r', type: 'reverse', fields: { front: '§ 130 BGB', back: 'Zugang' } },
  { ...base, id: 'z', type: 'cloze', fields: { text: 'Vorsatz ist {{c1::Wissen}} und {{c2::Wollen}}.', extra: 'extra' } },
  { ...base, id: 's', type: 'schema', fields: { title: 'Schema', steps: [{ label: 'A', content: 'a' }, { label: 'B', content: 'b' }] } },
  { ...base, id: 'st', type: 'streitstand', fields: { problem: 'Problem?', ansichten: [{ name: 'h. M.', argumente: ['arg 1', 'arg 2'] }], rechtsprechung: 'BGH', stellungnahme: 'h. M.' } },
];
const deck: Deck = { id: 'd', user_id: 'u', parent_id: null, name: 'zivilrecht', description: null, color: '#3DFBB0', icon: null, position: 0, fsrs_params: null, daily_new_limit: 20, daily_review_limit: 200, created_at: '', updated_at: '', deleted_at: null };

describe('CardFace', () => {
  it('renders every card type on both sides without throwing', () => {
    for (const card of cards) {
      const html = renderToStaticMarkup(<CardFace card={card} variant="fwd" side="both" />);
      expect(html.length).toBeGreaterThan(0);
    }
  });

  it('renders streitstand sections as collapsible details', () => {
    const html = renderToStaticMarkup(<CardFace card={cards[4]} variant="fwd" side="back" />);
    expect(html).toContain('<details');
    expect(html).toContain('h. M.');
    expect(html).toContain('rechtsprechung');
    expect(html).toContain('stellungnahme');
  });

  it('hides the active cloze gap on the front', () => {
    const html = renderToStaticMarkup(<CardFace card={cards[2]} variant="c1" side="front" />);
    expect(html).toContain('[…]');
    expect(html).not.toContain('Wissen');
    expect(html).toContain('Wollen');
  });
});

describe('CardEditor', () => {
  it('round-trips a card through draft and back', () => {
    for (const card of cards) {
      const draft = draftFromCard(card);
      expect(validateDraft(draft)).toBeNull();
      const back = cardFromDraft(draft, card);
      expect(back.type).toBe(card.type);
      expect(back.fields).toEqual(card.fields);
      expect(back.tags).toEqual(card.tags);
    }
  });

  it('validates empty drafts per type', () => {
    expect(validateDraft(emptyDraft('d', 'basic'))).toBe('vorderseite fehlt');
    expect(validateDraft(emptyDraft('d', 'cloze'))).toBe('text fehlt');
    expect(validateDraft({ ...emptyDraft('d', 'cloze'), cloze: { text: 'ohne lücke', extra: '' } })).toBe('mindestens eine lücke {{c1::…}}');
    expect(validateDraft(emptyDraft('d', 'schema'))).toBe('titel fehlt');
    expect(validateDraft(emptyDraft('d', 'streitstand'))).toBe('problem fehlt');
    expect(validateDraft(emptyDraft('', 'basic'))).toBe('deck wählen');
  });

  it('normalises tags and empty source', () => {
    const draft = { ...emptyDraft('d'), basic: { front: 'f', back: 'b' }, tags: ' Zivilrecht, BGB-AT,, zivilrecht ', source: '  ' };
    const card = cardFromDraft(draft, { id: 'x', user_id: 'u', created_at: 't' });
    expect(card.tags).toEqual(['zivilrecht', 'bgb-at']);
    expect(card.source).toBeNull();
  });

  it('renders the editor for every type without throwing', () => {
    for (const card of cards) {
      const html = renderToStaticMarkup(
        <CardEditor draft={draftFromCard(card)} onChange={() => {}} decks={[deck]} userId="u" cardId={card.id} />
      );
      expect(html).toContain('bearbeiten');
    }
  });
});

describe('DeckTree / CardList', () => {
  it('renders the tree with counts', () => {
    const counts = new Map([['d', { total: 3, due: 1, new: 2, suspended: 0, leech: 0 }]]);
    const html = renderToStaticMarkup(<DeckTree nodes={buildDeckTree([deck])} counts={counts} />);
    expect(html).toContain('zivilrecht');
    expect(html).toContain('/cards/decks?id=d');
  });

  it('renders rows and the empty state', () => {
    const rows: CardRow[] = cards.map((card) => ({ card, states: [], title: card.type, due: false, isNew: true, leech: false, suspended: false }));
    const html = renderToStaticMarkup(<CardList rows={rows} emptyText="leer" />);
    expect(html).toContain('/cards/c?id=b');
    expect(html).toContain('neu');
    expect(renderToStaticMarkup(<CardList rows={[]} emptyText="leer" />)).toContain('leer');
  });
});
