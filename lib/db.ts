import Dexie, { type EntityTable } from 'dexie';

interface CachedProduct {
  barcode: string;
  name: string;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  sugar_per_100g?: number;
  saturated_fat_per_100g?: number;
  serving_size?: string;
  cached_at: number;
}

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
  cachedProducts: EntityTable<CachedProduct, 'barcode'>;
  recentFoods: EntityTable<RecentFood, 'id'>;
  pendingSync: EntityTable<PendingSync, 'id'>;
};

db.version(1).stores({
  cachedProducts: 'barcode, name',
  recentFoods: '++id, food_name, last_used',
  pendingSync: '++id, table, created_at',
});

export { db };
export type { CachedProduct, RecentFood, PendingSync };
