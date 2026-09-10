import { describe, it } from 'vitest';

// Phase 3: ts-fsrs wrapper (features/cards/scheduler/fsrs.ts)
describe('fsrs wrapper', () => {
  it.todo('maps a new CardState to the ts-fsrs card shape and back without loss');
  it.todo('produces four preview intervals for again/hard/good/easy');
  it.todo('applies the global request retention and per-deck overrides');
  it.todo('increments lapses on "again" from review state');
  it.todo('flags a card as leech once lapses reach the threshold');
});
