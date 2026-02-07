import Dexie, { type EntityTable } from 'dexie';

interface RecentFood {
  id?: number;
  food_name: string;
  barcode?: string;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  last_used: number;
}

interface PendingSync {
  id?: number;
  table: string;
  action: 'insert' | 'update' | 'delete';
  data: Record<string, unknown>;
  created_at: number;
}

const db = new Dexie('FitTrackDB') as Dexie & {
  recentFoods: EntityTable<RecentFood, 'id'>;
  pendingSync: EntityTable<PendingSync, 'id'>;
};

db.version(1).stores({
  cachedProducts: 'barcode, name',
  recentFoods: '++id, food_name, last_used',
  pendingSync: '++id, table, created_at',
});

// v2: remove cachedProducts (no longer used)
db.version(2).stores({
  cachedProducts: null,
  recentFoods: '++id, food_name, last_used',
  pendingSync: '++id, table, created_at',
});

export { db };
export type { RecentFood, PendingSync };
