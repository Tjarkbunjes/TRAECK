export interface Profile {
  id: string;
  display_name: string | null;
  calorie_goal: number;
  protein_goal: number;
  carbs_goal: number;
  fat_goal: number;
  target_weight: number | null;
  created_at: string;
}

export interface FoodEntry {
  id: string;
  user_id: string;
  date: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  food_name: string;
  barcode: string | null;
  serving_grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar: number;
  saturated_fat: number;
  created_at: string;
}

export interface Workout {
  id: string;
  user_id: string;
  date: string;
  name: string | null;
  started_at: string | null;
  finished_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface WorkoutSet {
  id: string;
  workout_id: string;
  exercise_name: string;
  muscle_group: string | null;
  set_number: number;
  weight_kg: number | null;
  reps: number | null;
  rpe: number | null;
  created_at: string;
}

export interface WeightEntry {
  id: string;
  user_id: string;
  date: string;
  weight_kg: number;
  body_fat_pct: number | null;
  notes: string | null;
  created_at: string;
}

export interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted';
  nickname: string | null;
  created_at: string;
  // Populated separately
  friend_profile?: {
    id: string;
    display_name: string | null;
    email: string | null;
  };
}

export interface WorkoutTemplate {
  id: string;
  user_id: string;
  name: string;
  exercises: TemplateExercise[];
  created_at: string;
}

export interface TemplateExercise {
  exercise_name: string;
  muscle_group: string;
  default_sets: number;
}

export interface FoodFavorite {
  id: string;
  user_id: string;
  food_name: string;
  barcode: string | null;
  calories_per_100g: number | null;
  protein_per_100g: number | null;
  carbs_per_100g: number | null;
  fat_per_100g: number | null;
  sugar_per_100g: number | null;
  saturated_fat_per_100g: number | null;
  created_at: string;
}

export interface FoodProduct {
  name: string;
  barcode?: string;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  sugar_per_100g?: number;
  saturated_fat_per_100g?: number;
  serving_size?: string;
  image_url?: string;
}

export interface Exercise {
  name: string;
  muscleGroup: string;
}

export interface MealTemplate {
  id: string;
  user_id: string;
  name: string;
  meal_type: MealType | null;
  items: MealTemplateItem[];
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  created_at: string;
}

export interface MealTemplateItem {
  food_name: string;
  serving_grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar?: number;
  saturated_fat?: number;
  barcode?: string;
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'breakfast',
  lunch: 'lunch',
  dinner: 'dinner',
  snack: 'snack',
};

export interface DailyFoodAggregate {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export const MUSCLE_GROUP_LABELS: Record<string, string> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  legs: 'Legs',
  arms: 'Arms',
  core: 'Core',
  cardio: 'Cardio',
};
