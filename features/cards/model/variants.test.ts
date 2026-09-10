import { describe, it, expect } from 'vitest';
import type { Card } from '../types';
import { cardFaces, cardTitle, clozeBack, clozeFront, clozeIndices, duplicateKey, parseCloze, variantsForCard } from './variants';

const base = {
  id: 'c1',
  user_id: 'u',
  deck_id: 'd',
  tags: [],
  source: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  deleted_at: null,
};

const basic: Card = { ...base, type: 'basic', fields: { front: 'Was ist eine **Willenserklärung**?', back: 'Private Willensäußerung …' } };
const reverse: Card = { ...base, type: 'reverse', fields: { front: '§ 130 I 1 BGB', back: 'Zugang unter Abwesenden' } };
const cloze: Card = {
  ...base,
  type: 'cloze',
  fields: { text: 'Vorsatz ist {{c1::Wissen}} und {{c2::Wollen::W…}} der {{c1::Tatbestandsverwirklichung}}.', extra: 'dolus eventualis' },
};
const schema: Card = {
  ...base,
  type: 'schema',
  fields: { title: 'SE statt der Leistung', steps: [{ label: 'Schuldverhältnis', content: 'wirksam' }, { label: 'Pflichtverletzung', content: '§ 281 I 1' }] },
};
const streit: Card = {
  ...base,
  type: 'streitstand',
  fields: { problem: 'Rücktritt bei Zielerreichung?', ansichten: [{ name: 'h. M.', argumente: ['Opferschutz'] }], rechtsprechung: 'BGHSt 39, 221', stellungnahme: 'h. M.' },
};

describe('cloze parsing', () => {
  it('extracts gaps in document order with optional hints', () => {
    expect(parseCloze(cloze.fields.text)).toEqual([
      { index: 1, answer: 'Wissen', hint: null },
      { index: 2, answer: 'Wollen', hint: 'W…' },
      { index: 1, answer: 'Tatbestandsverwirklichung', hint: null },
    ]);
    expect(clozeIndices(cloze.fields.text)).toEqual([1, 2]);
    expect(clozeIndices('keine lücke')).toEqual([]);
  });

  it('hides only the active gap on the front and reveals it on the back', () => {
    expect(clozeFront(cloze.fields.text, 1)).toBe('Vorsatz ist **[…]** und Wollen der **[…]**.');
    expect(clozeFront(cloze.fields.text, 2)).toBe('Vorsatz ist Wissen und **[W…]** der Tatbestandsverwirklichung.');
    expect(clozeBack(cloze.fields.text, 2)).toBe('Vorsatz ist Wissen und **Wollen** der Tatbestandsverwirklichung.');
  });
});

describe('variantsForCard', () => {
  it('basic and streitstand have one variant, reverse two', () => {
    expect(variantsForCard(basic)).toEqual(['fwd']);
    expect(variantsForCard(streit)).toEqual(['fwd']);
    expect(variantsForCard(reverse)).toEqual(['fwd', 'rev']);
  });

  it('cloze has one variant per gap number, none without gaps', () => {
    expect(variantsForCard(cloze)).toEqual(['c1', 'c2']);
    expect(variantsForCard({ ...cloze, fields: { text: 'x', extra: '' } })).toEqual([]);
  });

  it('schema depends on the deck schema mode', () => {
    expect(variantsForCard(schema)).toEqual(['fwd']);
    expect(variantsForCard(schema, 'whole')).toEqual(['fwd']);
    expect(variantsForCard(schema, 'steps')).toEqual(['s1', 's2']);
    expect(variantsForCard({ ...schema, fields: { title: 't', steps: [] } }, 'steps')).toEqual(['fwd']);
  });
});

describe('cardFaces', () => {
  it('swaps reverse cards for the rev variant', () => {
    expect(cardFaces(reverse, 'fwd')).toMatchObject({ front: '§ 130 I 1 BGB', back: 'Zugang unter Abwesenden' });
    expect(cardFaces(reverse, 'rev')).toMatchObject({ front: 'Zugang unter Abwesenden', back: '§ 130 I 1 BGB' });
  });

  it('renders cloze per gap and carries extra', () => {
    const f = cardFaces(cloze, 'c2');
    expect(f).toMatchObject({ kind: 'markdown', extra: 'dolus eventualis' });
    if (f.kind === 'markdown') expect(f.front).toContain('**[W…]**');
    const unknown = cardFaces(cloze, 'zzz');
    if (unknown.kind === 'markdown') expect(unknown.front).toContain('**[…]** und Wollen');
  });

  it('renders schema whole and per step', () => {
    const whole = cardFaces(schema, 'fwd');
    if (whole.kind === 'markdown') {
      expect(whole.front).toBe('**SE statt der Leistung**');
      expect(whole.back).toBe('1. **Schuldverhältnis** — wirksam\n2. **Pflichtverletzung** — § 281 I 1');
    }
    const step2 = cardFaces(schema, 's2');
    if (step2.kind === 'markdown') {
      expect(step2.front).toBe('**SE statt der Leistung**\n\n1. Schuldverhältnis\n2. **?**');
      expect(step2.back).toBe('**SE statt der Leistung**\n\n2. **Pflichtverletzung** — § 281 I 1');
    }
  });

  it('returns structured fields for streitstand', () => {
    expect(cardFaces(streit, 'fwd')).toEqual({ kind: 'streitstand', front: 'Rücktritt bei Zielerreichung?', fields: streit.fields });
  });
});

describe('cardTitle / duplicateKey', () => {
  it('uses the first non-empty line of the question side', () => {
    expect(cardTitle(basic)).toBe('Was ist eine **Willenserklärung**?');
    expect(cardTitle(cloze)).toBe('Vorsatz ist Wissen und Wollen der Tatbestandsverwirklichung.');
    expect(cardTitle(schema)).toBe('SE statt der Leistung');
    expect(cardTitle({ ...basic, fields: { front: '\n\n  zweite zeile ', back: '' } })).toBe('zweite zeile');
  });

  it('normalises for duplicate detection', () => {
    expect(duplicateKey(basic)).toBe('was ist eine willenserklärung');
    expect(duplicateKey({ ...basic, fields: { front: 'WAS ist eine Willenserklärung ?', back: '' } })).toBe(duplicateKey(basic));
    expect(duplicateKey(reverse)).toBe('§ 130 i 1 bgb');
  });
});
