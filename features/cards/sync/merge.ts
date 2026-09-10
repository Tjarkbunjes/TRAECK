// Pure conflict-resolution helpers for the cards sync. Kept free of Dexie and
// Supabase so they are trivially unit-testable.

import type { CardsTable } from '../types';

/** Column the delta pull filters and orders by, per table. */
export const CURSOR_FIELD: Record<CardsTable, 'updated_at' | 'reviewed_at'> = {
  decks: 'updated_at',
  cards: 'updated_at',
  card_state: 'updated_at',
  reviews: 'reviewed_at',
};

/**
 * Overlap subtracted from the stored cursor on every pull. Devices set
 * updated_at from their own clocks, so a row written by a slightly-behind
 * device could otherwise slip under the cursor. Re-pulling is idempotent.
 */
export const CURSOR_OVERLAP_MS = 10 * 60 * 1000;

export function isNewer(candidate: string, reference: string): boolean {
  return Date.parse(candidate) > Date.parse(reference);
}

/**
 * Last-writer-wins on updated_at. Local wins ties so that a pending local
 * edit is not clobbered by the echo of its own upload.
 */
export function pickNewer<T extends { updated_at: string }>(local: T | undefined, remote: T): T {
  if (!local) return remote;
  return isNewer(remote.updated_at, local.updated_at) ? remote : local;
}

/** Highest cursor value in a batch, or the previous cursor when the batch is empty. */
export function advanceCursor(previous: string, values: readonly string[]): string {
  let max = previous;
  for (const v of values) if (isNewer(v, max)) max = v;
  return max;
}

/** Cursor to query with: stored cursor minus the overlap window, never before epoch. */
export function effectiveCursor(stored: string | undefined): string {
  if (!stored) return new Date(0).toISOString();
  const t = Date.parse(stored);
  if (Number.isNaN(t)) return new Date(0).toISOString();
  return new Date(Math.max(0, t - CURSOR_OVERLAP_MS)).toISOString();
}
