'use client';

import { useState, useEffect } from 'react';
import { format, addDays, subDays } from 'date-fns';
import { useAuth, useFoodEntries, useProfile } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import { MacroRings } from '@/components/MacroRings';
import { FoodEntryCard } from '@/components/FoodEntryCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Plus, ScanBarcode, UtensilsCrossed } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { MEAL_LABELS, type MealType, type MealTemplate, type FoodEntry } from '@/lib/types';

const mealOrder: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export default function FoodPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const { entries, loading, refresh } = useFoodEntries(date);
  const { profile } = useProfile();
  const [meals, setMeals] = useState<MealTemplate[]>([]);
  const [addingMeal, setAddingMeal] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('meal_templates')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setMeals(data as MealTemplate[]);
      });
  }, [user]);

  const totals = entries.reduce(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      protein: acc.protein + e.protein,
      carbs: acc.carbs + e.carbs,
      fat: acc.fat + e.fat,
      sugar: acc.sugar + (e.sugar || 0),
      saturated_fat: acc.saturated_fat + (e.saturated_fat || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, sugar: 0, saturated_fat: 0 }
  );

  async function handleDelete(id: string) {
    const { error } = await supabase.from('food_entries').delete().eq('id', id);
    if (error) {
      toast.error('failed to delete entry.');
    } else {
      refresh();
    }
  }

  function handleEdit(entry: FoodEntry) {
    router.push(`/food/add?date=${date}&edit=${entry.id}`);
  }

  async function addMealToLog(meal: MealTemplate) {
    if (!user) return;
    setAddingMeal(meal.id);

    const mealType = meal.meal_type || 'lunch';
    const entries = meal.items.map((item) => ({
      user_id: user.id,
      date,
      meal_type: mealType,
      food_name: item.food_name,
      barcode: item.barcode || null,
      serving_grams: item.serving_grams,
      calories: item.calories,
      protein: item.protein,
      carbs: item.carbs,
      fat: item.fat,
      sugar: item.sugar || 0,
      saturated_fat: item.saturated_fat || 0,
    }));

    const { error } = await supabase.from('food_entries').insert(entries);
    if (error) {
      console.error('Meal add error:', error);
      toast.error(`error: ${error.message}`);
    } else {
      toast.success(`"${meal.name}" added.`);
      refresh();
    }
    setAddingMeal(null);
  }

  const isToday = date === format(new Date(), 'yyyy-MM-dd');

  return (
    <div className="mx-auto max-w-md p-4 space-y-4">
      {/* Date Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => setDate(format(subDays(new Date(date + 'T12:00:00'), 1), 'yyyy-MM-dd'))}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold">
          {isToday ? 'today' : format(new Date(date + 'T12:00:00'), 'EEEE, MMM d')}
        </h1>
        <Button variant="ghost" size="icon" onClick={() => setDate(format(addDays(new Date(date + 'T12:00:00'), 1), 'yyyy-MM-dd'))}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Macro Summary */}
      {profile && (
        <MacroRings
          calories={totals.calories}
          calorieGoal={profile.calorie_goal}
          protein={totals.protein}
          proteinGoal={profile.protein_goal}
          carbs={totals.carbs}
          carbsGoal={profile.carbs_goal}
          fat={totals.fat}
          fatGoal={profile.fat_goal}
        />
      )}

      {/* Sugar & Saturated Fat Summary */}
      {(totals.sugar > 0 || totals.saturated_fat > 0) && (
        <div className="flex justify-center gap-6 text-xs text-muted-foreground">
          <span>of which sugar: <span className="font-medium font-mono text-foreground">{Math.round(totals.sugar)}g</span></span>
          <span>of which sat. fat: <span className="font-medium font-mono text-foreground">{Math.round(totals.saturated_fat)}g</span></span>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-2">
        <Button asChild className="h-11">
          <Link href={`/food/add?date=${date}`}>
            <Plus className="mr-1.5 h-4 w-4" />
            add
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-11">
          <Link href={`/food/scan?date=${date}`}>
            <ScanBarcode className="mr-1.5 h-4 w-4" />
            scan
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-11">
          <Link href="/food/meals">
            <UtensilsCrossed className="mr-1.5 h-4 w-4" />
            meals
          </Link>
        </Button>
      </div>

      {/* Saved Meals Quick Add */}
      {meals.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground mb-2">quick add</h2>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {meals.map((meal) => (
              <button
                key={meal.id}
                onClick={() => addMealToLog(meal)}
                disabled={addingMeal === meal.id}
                className="shrink-0 rounded-lg border border-border bg-card px-3 py-2 text-left transition-colors hover:bg-accent/50 disabled:opacity-50"
              >
                <p className="text-sm font-medium whitespace-nowrap">{meal.name}</p>
                <p className="text-[10px] text-muted-foreground font-mono">{Math.round(meal.total_calories)} kcal</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Meal Groups */}
      {loading ? (
        <p className="text-center text-muted-foreground py-8">loading...</p>
      ) : entries.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">
          no entries for this day yet.
        </p>
      ) : (
        mealOrder.map((meal) => {
          const mealEntries = entries.filter((e) => e.meal_type === meal);
          if (mealEntries.length === 0) return null;
          const mealCals = mealEntries.reduce((s, e) => s + e.calories, 0);
          return (
            <div key={meal} className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-muted-foreground">
                  {MEAL_LABELS[meal]}
                </h2>
                <span className="text-sm text-muted-foreground font-mono">{Math.round(mealCals)} kcal</span>
              </div>
              {mealEntries.map((entry) => (
                <FoodEntryCard key={entry.id} entry={entry} onDelete={handleDelete} onEdit={handleEdit} />
              ))}
            </div>
          );
        })
      )}
    </div>
  );
}
