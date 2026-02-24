import { supabase } from './supabase';
import type { AIFoodResult } from './types';

export async function analyzeFood(
  imageFile: File,
  userId: string,
  description?: string,
): Promise<AIFoodResult[]> {
  // 1. Upload image to Supabase Storage
  const ext = imageFile.name.split('.').pop() || 'jpg';
  const path = `${userId}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('food-images')
    .upload(path, imageFile, { contentType: imageFile.type, upsert: false });

  if (uploadError) {
    throw new Error(`Image upload failed: ${uploadError.message}`);
  }

  const { data: urlData } = supabase.storage
    .from('food-images')
    .getPublicUrl(path);

  const imageUrl = urlData.publicUrl;

  // 2. Call Edge Function
  const { data, error } = await supabase.functions.invoke('analyze-food', {
    body: { imageUrl, description },
  });

  if (error) {
    throw new Error(`AI analysis failed: ${error.message}`);
  }

  if (!data?.foods || !Array.isArray(data.foods)) {
    throw new Error('Invalid response from AI');
  }

  // 3. Validate and return results
  return data.foods.map((f: Record<string, unknown>) => ({
    name: String(f.name || 'Unknown'),
    serving_grams: Number(f.serving_grams) || 100,
    calories: Number(f.calories) || 0,
    protein: Number(f.protein) || 0,
    carbs: Number(f.carbs) || 0,
    fat: Number(f.fat) || 0,
    sugar: Number(f.sugar) || 0,
    saturated_fat: Number(f.saturated_fat) || 0,
  }));
}
