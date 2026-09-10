// Outbox on top of the shared pendingSync table in lib/db.ts. Entries carry
// only the primary key of the row; the sync worker reads the row's current
// local version at push time, so the newest local state always wins.

import { db, type PendingSync } from '@/lib/db';
import type { CardsTable } from '../types';

export type OutboxAction = PendingSync['action'];

export type RowKey =
  | { id: string }
  | { card_id: string; variant: string };

export async function enqueue(table: CardsTable, action: OutboxAction, key: RowKey): Promise<void> {
  await db.pendingSync.add({ table, action, data: key, created_at: Date.now() });
}

export async function pendingCount(): Promise<number> {
  return db.pendingSync.where('table').anyOf(['decks', 'cards', 'card_state', 'reviews']).count();
}
