// Sync worker for the cards tables. Runs entirely in the browser:
//
//   pull  — delta per table (cursor field > last cursor − overlap), merged into
//           Dexie with last-writer-wins on updated_at (reviews are append-only)
//   push  — drains the outbox in insertion order, upserting the *current* local
//           row (or deleting by key) in Supabase
//
// Pull runs before push so a newer remote edit overrides a stale local edit
// before that local row is uploaded. Everything is scoped to the signed-in
// user; the four tables are the only ones this worker touches.

import { supabase } from '@/lib/supabase';
import { db, type PendingSync } from '@/lib/db';
import { CARDS_TABLES, type Card, type CardState, type CardsRowByTable, type CardsTable, type Deck, type Review } from '../types';
import { CURSOR_FIELD, advanceCursor, effectiveCursor, pickNewer } from './merge';
import { pendingCount } from './outbox';

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error';

export interface SyncState {
  status: SyncStatus;
  pending: number;
  lastSyncedAt: string | null;
  error: string | null;
}

const PAGE_SIZE = 500;

let state: SyncState = { status: 'idle', pending: 0, lastSyncedAt: null, error: null };
const stateListeners = new Set<(s: SyncState) => void>();
const changeListeners = new Set<() => void>();
let inFlight: Promise<void> | null = null;
let rerun = false;

function setState(patch: Partial<SyncState>) {
  state = { ...state, ...patch };
  for (const l of stateListeners) l(state);
}

export function getSyncState(): SyncState {
  return state;
}

export function subscribeSyncState(listener: (s: SyncState) => void): () => void {
  stateListeners.add(listener);
  return () => { stateListeners.delete(listener); };
}

/** Fired after a pull merged remote rows or the outbox drained — hooks re-read Dexie on it. */
export function onCardsChanged(listener: () => void): () => void {
  changeListeners.add(listener);
  return () => { changeListeners.delete(listener); };
}

export function emitCardsChanged(): void {
  for (const l of changeListeners) l();
}

export async function refreshPendingCount(): Promise<void> {
  setState({ pending: await pendingCount() });
}

/**
 * Run a full sync (pull, then push). Concurrent calls coalesce: a request made
 * while a sync is running schedules exactly one follow-up run.
 */
export function requestSync(): Promise<void> {
  if (inFlight) {
    rerun = true;
    return inFlight;
  }
  inFlight = run().finally(() => {
    inFlight = null;
    if (rerun) {
      rerun = false;
      void requestSync();
    }
  });
  return inFlight;
}

async function run(): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    setState({ status: 'offline' });
    await refreshPendingCount();
    return;
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    await refreshPendingCount();
    return;
  }

  setState({ status: 'syncing', error: null });
  try {
    for (const table of CARDS_TABLES) await pullTable(table, user.id);
    await pushOutbox();
    setState({ status: 'idle', lastSyncedAt: new Date().toISOString() });
    emitCardsChanged();
  } catch (e) {
    setState({ status: 'error', error: e instanceof Error ? e.message : String(e) });
  } finally {
    await refreshPendingCount();
  }
}

// ── pull ─────────────────────────────────────────────────────────────────────

function cursorKey(table: CardsTable, userId: string): string {
  return `cards:cursor:${table}:${userId}`;
}

async function pullTable<T extends CardsTable>(table: T, userId: string): Promise<void> {
  const field = CURSOR_FIELD[table];
  const key = cursorKey(table, userId);
  const stored = (await db.syncMeta.get(key))?.value;
  const since = effectiveCursor(stored);

  let cursor = stored ?? since;
  let offset = 0;
  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('user_id', userId)
      .gt(field, since)
      .order(field, { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(`pull ${table}: ${error.message}`);

    const rows = (data ?? []) as CardsRowByTable[T][];
    if (rows.length === 0) break;

    await mergeRows(table, rows);
    cursor = advanceCursor(cursor, rows.map((r) => r[field as keyof CardsRowByTable[T]] as string));

    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  await db.syncMeta.put({ key, value: cursor });
}

async function mergeRows<T extends CardsTable>(table: T, rows: CardsRowByTable[T][]): Promise<void> {
  switch (table) {
    case 'decks': {
      const incoming = rows as Deck[];
      await db.transaction('rw', db.decks, async () => {
        const local = await db.decks.bulkGet(incoming.map((r) => r.id));
        await db.decks.bulkPut(incoming.map((r, i) => pickNewer(local[i], r)));
      });
      return;
    }
    case 'cards': {
      const incoming = rows as Card[];
      await db.transaction('rw', db.cards, async () => {
        const local = await db.cards.bulkGet(incoming.map((r) => r.id));
        await db.cards.bulkPut(incoming.map((r, i) => pickNewer(local[i], r)));
      });
      return;
    }
    case 'card_state': {
      const incoming = rows as CardState[];
      await db.transaction('rw', db.card_state, async () => {
        const local = await db.card_state.bulkGet(incoming.map((r) => [r.card_id, r.variant] as [string, string]));
        await db.card_state.bulkPut(incoming.map((r, i) => pickNewer(local[i], r)));
      });
      return;
    }
    case 'reviews': {
      // append-only: a review never changes once written
      await db.reviews.bulkPut(rows as Review[]);
      return;
    }
  }
}

// ── push ─────────────────────────────────────────────────────────────────────

function isCardsTable(name: string): name is CardsTable {
  return (CARDS_TABLES as readonly string[]).includes(name);
}

async function pushOutbox(): Promise<void> {
  const entries = await db.pendingSync.orderBy('id').toArray();
  for (const entry of entries) {
    if (!isCardsTable(entry.table)) continue; // not ours — leave it alone
    await pushEntry(entry);
    if (entry.id !== undefined) await db.pendingSync.delete(entry.id);
  }
}

async function pushEntry(entry: PendingSync): Promise<void> {
  const table = entry.table as CardsTable;
  const key = entry.data;

  if (entry.action === 'delete') {
    const { error } = await supabase.from(table).delete().match(key);
    if (error) throw new Error(`delete ${table}: ${error.message}`);
    return;
  }

  const row = await readLocal(table, key);
  if (!row) return; // deleted locally before it was ever pushed

  const onConflict = table === 'card_state' ? 'card_id,variant' : 'id';
  const { error } = await supabase.from(table).upsert(row, { onConflict });
  if (error) throw new Error(`upsert ${table}: ${error.message}`);
}

async function readLocal(table: CardsTable, key: Record<string, unknown>): Promise<CardsRowByTable[CardsTable] | undefined> {
  switch (table) {
    case 'decks':
      return typeof key.id === 'string' ? db.decks.get(key.id) : undefined;
    case 'cards':
      return typeof key.id === 'string' ? db.cards.get(key.id) : undefined;
    case 'reviews':
      return typeof key.id === 'string' ? db.reviews.get(key.id) : undefined;
    case 'card_state':
      return typeof key.card_id === 'string' && typeof key.variant === 'string'
        ? db.card_state.get([key.card_id, key.variant])
        : undefined;
  }
}
