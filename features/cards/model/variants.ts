// Which learnable variants a card has, and what each variant shows on its
// front and back. Pure — the renderer only turns the returned markdown into
// React. Variant ids are the `variant` column of card_state/reviews.

import type { Card, SchemaMode, StreitstandFields } from '../types';

export const VARIANT_FWD = 'fwd';
export const VARIANT_REV = 'rev';

// {{c1::answer}} or {{c1::answer::hint}}
const CLOZE_RE = /\{\{c(\d+)::((?:(?!\}\}).)*?)\}\}/g;

export interface ClozeGap {
  index: number;
  answer: string;
  hint: string | null;
}

export function parseCloze(text: string): ClozeGap[] {
  const gaps: ClozeGap[] = [];
  for (const m of text.matchAll(CLOZE_RE)) {
    const [answer, ...rest] = m[2].split('::');
    gaps.push({ index: Number(m[1]), answer, hint: rest.length ? rest.join('::') : null });
  }
  return gaps;
}

/** Distinct gap numbers in ascending order — one card variant per number. */
export function clozeIndices(text: string): number[] {
  return [...new Set(parseCloze(text).map((g) => g.index))].sort((a, b) => a - b);
}

function replaceCloze(text: string, fn: (gap: ClozeGap) => string): string {
  return text.replace(CLOZE_RE, (_m, n: string, body: string) => {
    const [answer, ...rest] = body.split('::');
    return fn({ index: Number(n), answer, hint: rest.length ? rest.join('::') : null });
  });
}

/** Active gap hidden as `[…]` (or its hint), every other gap shown as plain text. */
export function clozeFront(text: string, active: number): string {
  return replaceCloze(text, (g) => (g.index === active ? `**[${g.hint ?? '…'}]**` : g.answer));
}

/** Active gap revealed in bold, every other gap plain. */
export function clozeBack(text: string, active: number): string {
  return replaceCloze(text, (g) => (g.index === active ? `**${g.answer}**` : g.answer));
}

export function schemaStepVariant(n: number): string {
  return `s${n}`;
}

export function variantsForCard(card: Card, schemaMode: SchemaMode = 'whole'): string[] {
  switch (card.type) {
    case 'basic':
    case 'streitstand':
      return [VARIANT_FWD];
    case 'reverse':
      return [VARIANT_FWD, VARIANT_REV];
    case 'cloze': {
      const idx = clozeIndices(card.fields.text);
      return idx.length ? idx.map((i) => `c${i}`) : [];
    }
    case 'schema':
      return schemaMode === 'steps' && card.fields.steps.length
        ? card.fields.steps.map((_, i) => schemaStepVariant(i + 1))
        : [VARIANT_FWD];
  }
}

export type CardFaces =
  | { kind: 'markdown'; front: string; back: string; extra: string | null }
  | { kind: 'streitstand'; front: string; fields: StreitstandFields };

function stepsMarkdown(steps: { label: string; content: string }[]): string {
  return steps.map((s, i) => `${i + 1}. **${s.label}** — ${s.content}`).join('\n');
}

/** Front/back content for one variant. Unknown variants fall back to the whole card. */
export function cardFaces(card: Card, variant: string): CardFaces {
  switch (card.type) {
    case 'basic':
      return { kind: 'markdown', front: card.fields.front, back: card.fields.back, extra: null };
    case 'reverse':
      return variant === VARIANT_REV
        ? { kind: 'markdown', front: card.fields.back, back: card.fields.front, extra: null }
        : { kind: 'markdown', front: card.fields.front, back: card.fields.back, extra: null };
    case 'cloze': {
      const n = Number(variant.replace(/^c/, ''));
      const active = Number.isInteger(n) && n > 0 ? n : (clozeIndices(card.fields.text)[0] ?? 1);
      return {
        kind: 'markdown',
        front: clozeFront(card.fields.text, active),
        back: clozeBack(card.fields.text, active),
        extra: card.fields.extra.trim() ? card.fields.extra : null,
      };
    }
    case 'schema': {
      const { title, steps } = card.fields;
      const n = Number(variant.replace(/^s/, ''));
      if (Number.isInteger(n) && n >= 1 && n <= steps.length) {
        const before = steps.slice(0, n - 1).map((s, i) => `${i + 1}. ${s.label}`).join('\n');
        const step = steps[n - 1];
        return {
          kind: 'markdown',
          front: `**${title}**\n\n${before ? `${before}\n` : ''}${n}. **?**`,
          back: `**${title}**\n\n${n}. **${step.label}** — ${step.content}`,
          extra: null,
        };
      }
      return { kind: 'markdown', front: `**${title}**`, back: stepsMarkdown(steps), extra: null };
    }
    case 'streitstand':
      return { kind: 'streitstand', front: card.fields.problem, fields: card.fields };
  }
}

/** One-line label for lists and duplicate checks. */
export function cardTitle(card: Card): string {
  const first = (s: string) => s.split('\n').map((l) => l.trim()).find((l) => l.length > 0) ?? '';
  switch (card.type) {
    case 'basic':
    case 'reverse':
      return first(card.fields.front);
    case 'cloze':
      return first(replaceCloze(card.fields.text, (g) => g.answer));
    case 'schema':
      return first(card.fields.title);
    case 'streitstand':
      return first(card.fields.problem);
  }
}

/** Normalised key for duplicate detection: lowercase, punctuation and markdown stripped. */
export function duplicateKey(card: Card): string {
  return cardTitle(card)
    .toLowerCase()
    .replace(/[*_`#>\[\]()]/g, '')
    .replace(/[^\p{L}\p{N}§]+/gu, ' ')
    .trim();
}
