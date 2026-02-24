import { supabase } from './supabase';
import type { AIFoodResult } from './types';

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data:image/...;base64, prefix
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function analyzeFood(
  imageFile: File,
  description?: string,
): Promise<AIFoodResult[]> {
  const imageBase64 = await fileToBase64(imageFile);

  const { data, error } = await supabase.functions.invoke('analyze-food', {
    body: { imageBase64, mimeType: imageFile.type, description },
  });

  if (error) {
    throw new Error(`AI analysis failed: ${error.message}`);
  }

  if (!data?.foods || !Array.isArray(data.foods)) {
    throw new Error('Invalid response from AI');
  }

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
