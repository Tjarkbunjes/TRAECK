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
  requester_nickname: string | null;
  addressee_nickname: string | null;
  // Resolved per-user nickname (set in useFriends hook)
  nickname?: string | null;
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
  is_default: boolean;
  created_at: string;
}

export interface TemplateExercise {
  exercise_name: string;
  muscle_group: string;
  default_sets: number;
}

export interface WorkoutExercise {
  id: string;
  workout_id: string;
  exercise_name: string;
  muscle_group: string | null;
  sort_order: number;
  created_at: string;
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

export interface GarminHealthEntry {
  id: string;
  user_id: string;
  date: string;
  steps: number | null;
  step_goal: number | null;
  resting_hr: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  sleep_score: number | null;
  sleep_seconds: number | null;
  body_battery_high: number | null;
  stress_avg: number | null;
  calories_active: number | null;
  distance_meters: number | null;
  hr_values: Array<{ t: number; hr: number }> | null;
  fetched_at: string;
}

export interface JournalEntry {
  id: string;
  user_id: string;
  date: string;
  hours_slept: number | null;
  sleep_quality: number | null;
  sweets: boolean | null;
  last_meal_time: string | null;
  alcohol: boolean | null;
  alcohol_amount: number | null;
  sex: boolean | null;
  magnesium_zinc: boolean | null;
  caffeine: boolean | null;
  caffeine_amount: number | null;
  stress_level: number | null;
  screen_before_bed: boolean | null;
  mood: number | null;
  energy_level: number | null;
  hydration: number | null;
  slept_with_partner: boolean | null;
  note: string | null;
  created_at: string;
}

export interface AppleHealthEntry {
  id: number;
  type: string;
  value: string;
  start_date: string;
  user_id: string;
  uploaded_at: string;
}

export interface AIFoodResult {
  name: string;
  serving_grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar: number;
  saturated_fat: number;
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

export interface CreditCardTransaction {
  id: string;
  user_id: string;
  transaction_date: string;
  booking_date: string;
  amount: number;
  currency: string;
  merchant: string;
  description: string | null;
  category: string | null;
  booking_reference: string | null;
  created_at: string;
}

export interface MonthlyBudget {
  id: string;
  user_id: string;
  month: string;
  budget_amount: number;
}

export const SPENDING_CATEGORIES: Record<string, { label: string; color: string }> = {
  transport: { label: 'Transport', color: '#F59E0B' },
  dining: { label: 'Dining & Bars', color: '#EF4444' },
  groceries: { label: 'Groceries', color: '#22C55E' },
  shopping: { label: 'Shopping', color: '#A78BFA' },
  entertainment: { label: 'Entertainment', color: '#EC4899' },
  subscriptions: { label: 'Subscriptions', color: '#6366F1' },
  other: { label: 'Other', color: '#6B7280' },
};
