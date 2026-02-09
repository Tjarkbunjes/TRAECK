import type { FoodProduct } from './types';

const OFF_BASES = [
  'https://world.openfoodfacts.org/api/v2/product',
  'https://world.openfoodfacts.net/api/v2/product',
];
const OFF_HEADERS = { 'User-Agent': 'TRAECK/1.0 (traeck-pwa)' };

function parseProduct(p: Record<string, unknown>, barcode: string): FoodProduct {
  const n = p.nutriments as Record<string, number> | undefined;
  return {
    name: (p.product_name || p.product_name_de || 'Unknown Product') as string,
    barcode,
    calories_per_100g: n?.['energy-kcal_100g'] || 0,
    protein_per_100g: n?.proteins_100g || 0,
    carbs_per_100g: n?.carbohydrates_100g || 0,
    fat_per_100g: n?.fat_100g || 0,
    sugar_per_100g: n?.sugars_100g || 0,
    saturated_fat_per_100g: n?.['saturated-fat_100g'] || 0,
    serving_size: (p.serving_size as string) || undefined,
    image_url: (p.image_front_small_url || p.image_front_url) as string | undefined,
  };
}

async function fetchWithTimeout(url: string, timeoutMs = 5000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const res = await fetch(url, { headers: OFF_HEADERS, signal: controller.signal });
  clearTimeout(timeout);
  return res;
}

export async function lookupBarcode(barcode: string): Promise<FoodProduct | null> {
  const codes = [barcode];
  if (barcode.startsWith('0') && barcode.length === 13) {
    codes.push(barcode.substring(1));
  }

  for (const base of OFF_BASES) {
    for (const code of codes) {
      try {
        const res = await fetchWithTimeout(`${base}/${code}.json`);
        const data = await res.json();
        if (data.status === 1 && data.product) {
          return parseProduct(data.product, barcode);
        }
      } catch {
        continue;
      }
    }
  }

  return null;
}

export async function searchFood(query: string): Promise<FoodProduct[]> {
  const urls = [
    `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=10`,
    `https://world.openfoodfacts.net/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=10`,
  ];

  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(url, { headers: OFF_HEADERS, signal: controller.signal });
      clearTimeout(timeout);
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
            sugar_per_100g: (p.nutriments as Record<string, number>)?.sugars_100g || 0,
            saturated_fat_per_100g: (p.nutriments as Record<string, number>)?.['saturated-fat_100g'] || 0,
          }));
      }
    } catch {
      continue;
    }
  }
  return [];
}
