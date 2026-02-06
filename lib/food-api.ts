import { db } from './db';
import type { FoodProduct } from './types';

const OFF_BASE = 'https://world.openfoodfacts.org/api/v2/product';
const OFF_HEADERS = { 'User-Agent': 'FitTrack/1.0 (fittrack-pwa)' };

export async function lookupBarcode(barcode: string): Promise<FoodProduct | null> {
  // 1. Check IndexedDB cache
  const cached = await db.cachedProducts.get(barcode);
  if (cached) {
    return {
      name: cached.name,
      barcode: cached.barcode,
      calories_per_100g: cached.calories_per_100g,
      protein_per_100g: cached.protein_per_100g,
      carbs_per_100g: cached.carbs_per_100g,
      fat_per_100g: cached.fat_per_100g,
      sugar_per_100g: cached.sugar_per_100g || 0,
      saturated_fat_per_100g: cached.saturated_fat_per_100g || 0,
      serving_size: cached.serving_size,
    };
  }

  // 2. Open Food Facts API
  try {
    const res = await fetch(`${OFF_BASE}/${barcode}.json`, { headers: OFF_HEADERS });
    const data = await res.json();
    if (data.status === 1 && data.product) {
      const p = data.product;
      const product: FoodProduct = {
        name: p.product_name || p.product_name_de || 'Unbekanntes Produkt',
        barcode,
        calories_per_100g: p.nutriments?.['energy-kcal_100g'] || 0,
        protein_per_100g: p.nutriments?.proteins_100g || 0,
        carbs_per_100g: p.nutriments?.carbohydrates_100g || 0,
        fat_per_100g: p.nutriments?.fat_100g || 0,
        sugar_per_100g: p.nutriments?.sugars_100g || 0,
        saturated_fat_per_100g: p.nutriments?.['saturated-fat_100g'] || 0,
        serving_size: p.serving_size || undefined,
      };

      // Cache in IndexedDB
      await db.cachedProducts.put({
        ...product,
        cached_at: Date.now(),
      });

      return product;
    }

    // iOS reports UPC-A as EAN-13 with leading "0" - try stripping it
    if (barcode.startsWith('0') && barcode.length === 13) {
      const stripped = barcode.substring(1);
      const res2 = await fetch(`${OFF_BASE}/${stripped}.json`, { headers: OFF_HEADERS });
      const data2 = await res2.json();
      if (data2.status === 1 && data2.product) {
        const p = data2.product;
        const product: FoodProduct = {
          name: p.product_name || p.product_name_de || 'Unbekanntes Produkt',
          barcode,
          calories_per_100g: p.nutriments?.['energy-kcal_100g'] || 0,
          protein_per_100g: p.nutriments?.proteins_100g || 0,
          carbs_per_100g: p.nutriments?.carbohydrates_100g || 0,
          fat_per_100g: p.nutriments?.fat_100g || 0,
          sugar_per_100g: p.nutriments?.sugars_100g || 0,
          saturated_fat_per_100g: p.nutriments?.['saturated-fat_100g'] || 0,
          serving_size: p.serving_size || undefined,
        };
        await db.cachedProducts.put({ ...product, cached_at: Date.now() });
        return product;
      }
    }
  } catch {
    // Network error - offline
  }

  return null;
}

export async function searchFood(query: string): Promise<FoodProduct[]> {
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=10`,
      { headers: OFF_HEADERS }
    );
    const data = await res.json();
    if (data.products) {
      return data.products
        .filter((p: Record<string, unknown>) => p.product_name)
        .map((p: Record<string, unknown>) => ({
          name: p.product_name as string,
          barcode: p.code as string | undefined,
          calories_per_100g: (p.nutriments as Record<string, number>)?.['energy-kcal_100g'] || 0,
          protein_per_100g: (p.nutriments as Record<string, number>)?.proteins_100g || 0,
          carbs_per_100g: (p.nutriments as Record<string, number>)?.carbohydrates_100g || 0,
          fat_per_100g: (p.nutriments as Record<string, number>)?.fat_100g || 0,
        }));
    }
  } catch {
    // offline
  }
  return [];
}
