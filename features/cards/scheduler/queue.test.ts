import { describe, it } from 'vitest';

// Phase 3: queue builder (features/cards/scheduler/queue.ts)
describe('queue builder', () => {
  it.todo('puts due reviews before new cards in due-first order');
  it.todo('caps new and review cards per deck at the deck limits');
  it.todo('interleaves decks instead of emitting one deck as a block');
  it.todo('respects "deck für deck" ordering when configured');
  it.todo('excludes suspended cards and cards of soft-deleted decks');
  it.todo('honours focus mode (single deck or tag)');
});
