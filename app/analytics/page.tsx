'use client';

import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useAuth, useWeightEntries, useProfile, useAnalyticsWorkouts, useAnalyticsFood } from '@/lib/hooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const WeightChart = dynamic(() => import('@/components/WeightChart').then(m => ({ default: m.WeightChart })), { ssr: false });
const CalorieChart = dynamic(() => import('@/components/CalorieChart').then(m => ({ default: m.CalorieChart })), { ssr: false });
const MuscleRadarChart = dynamic(() => import('@/components/MuscleRadarChart').then(m => ({ default: m.MuscleRadarChart })), { ssr: false });
const ExerciseProgressionChart = dynamic(() => import('@/components/ExerciseProgressionChart').then(m => ({ default: m.ExerciseProgressionChart })), { ssr: false });
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingDown, TrendingUp, Minus, Loader2 } from 'lucide-react';

type TimeRange = '7' | '30' | '90' | '365';
type Category = string; // 'all' or a workout name

export default function AnalyticsPage() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [range, setRange] = useState<TimeRange>('30');
  const days = parseInt(range);

  const { entries: weightEntries, loading: weightLoading } = useWeightEntries(days);
  const { workouts, sets, loading: workoutLoading } = useAnalyticsWorkouts(days);
  const { dailyFood, loading: foodLoading } = useAnalyticsFood(days);

  const [radarMode, setRadarMode] = useState<'sets' | 'reps'>('sets');
  const [category, setCategory] = useState<Category>('all');

  // Build workout name categories from actual data
  const workoutCategories = useMemo(() => {
    const names = new Map<string, number>();
    for (const w of workouts) {
      const name = w.name || 'Workout';
      names.set(name, (names.get(name) ?? 0) + 1);
    }
    // Sort by frequency (most used first)
    return Array.from(names.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);
  }, [workouts]);

  // Map workout_id → workout name for filtering sets
  const workoutNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const w of workouts) {
      map.set(w.id, w.name || 'Workout');
    }
    return map;
  }, [workouts]);

  // Weight stats
  const latest = weightEntries.length > 0 ? weightEntries[weightEntries.length - 1] : null;
  const previous = weightEntries.length > 1 ? weightEntries[weightEntries.length - 2] : null;
  const diff = latest && previous ? Math.round((latest.weight_kg - previous.weight_kg) * 10) / 10 : null;
  const last7 = weightEntries.slice(-7);
  const avg7 = last7.length > 0
    ? Math.round((last7.reduce((s, e) => s + e.weight_kg, 0) / last7.length) * 10) / 10
    : null;

  // Nutrition stats
  const avgCalories = dailyFood.length > 0
    ? Math.round(dailyFood.reduce((s, d) => s + d.calories, 0) / dailyFood.length)
    : 0;
  const avgProtein = dailyFood.length > 0
    ? Math.round(dailyFood.reduce((s, d) => s + d.protein, 0) / dailyFood.length)
    : 0;
  const avgCarbs = dailyFood.length > 0
    ? Math.round(dailyFood.reduce((s, d) => s + d.carbs, 0) / dailyFood.length)
    : 0;
  const avgFat = dailyFood.length > 0
    ? Math.round(dailyFood.reduce((s, d) => s + d.fat, 0) / dailyFood.length)
    : 0;

  // Calorie trend
  const calorieTrend = useMemo(() => {
    if (dailyFood.length < 2) return 0;
    const sorted = [...dailyFood].sort((a, b) => a.date.localeCompare(b.date));
    const recentDays = sorted.slice(-7);
    const prevDays = sorted.slice(-14, -7);
    if (prevDays.length === 0 || recentDays.length === 0) return 0;
    const recentAvg = recentDays.reduce((s, d) => s + d.calories, 0) / recentDays.length;
    const prevAvg = prevDays.reduce((s, d) => s + d.calories, 0) / prevDays.length;
    if (prevAvg === 0) return 0;
    return Math.round(((recentAvg - prevAvg) / prevAvg) * 100);
  }, [dailyFood]);

  // Filtered exercises for progression
  const [showAllExercises, setShowAllExercises] = useState(false);

  const filteredExercises = useMemo(() => {
    let filtered = sets;
    if (category !== 'all') {
      // Get workout IDs that match the selected workout name
      const matchingIds = new Set(
        workouts.filter(w => (w.name || 'Workout') === category).map(w => w.id)
      );
      filtered = sets.filter(s => matchingIds.has(s.workout_id));
    }

    // Group by exercise, count total volume to sort
    const exerciseMap = new Map<string, number>();
    for (const s of filtered) {
      const vol = (s.weight_kg ?? 0) * (s.reps ?? 0);
      exerciseMap.set(s.exercise_name, (exerciseMap.get(s.exercise_name) ?? 0) + vol);
    }

    return Array.from(exerciseMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);
  }, [sets, category, workouts]);

  const isLoading = weightLoading || workoutLoading || foodLoading;

  if (!user) {
    return (
      <div className="mx-auto max-w-md p-4 flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">please sign in to view analytics.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">analytics</h1>
        <Tabs value={range} onValueChange={(v) => setRange(v as TimeRange)}>
          <TabsList className="h-8">
            <TabsTrigger value="7" className="text-xs px-2 h-6">7d</TabsTrigger>
            <TabsTrigger value="30" className="text-xs px-2 h-6">30d</TabsTrigger>
            <TabsTrigger value="90" className="text-xs px-2 h-6">90d</TabsTrigger>
            <TabsTrigger value="365" className="text-xs px-2 h-6">1y</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && (
        <>
          {/* ── Weight Section ── */}
          <section className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground">weight</h2>
            <div className="grid grid-cols-3 gap-2">
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-bold font-mono">{latest?.weight_kg || '–'}</p>
                  <p className="text-xs text-muted-foreground">current (kg)</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-bold font-mono flex items-center justify-center gap-1">
                    {diff !== null ? (
                      <>
                        {diff > 0 ? <TrendingUp className="h-4 w-4 text-rose-500" /> : diff < 0 ? <TrendingDown className="h-4 w-4 text-green-500" /> : <Minus className="h-4 w-4" />}
                        {Math.abs(diff).toFixed(1)}
                      </>
                    ) : '–'}
                  </p>
                  <p className="text-xs text-muted-foreground">change (kg)</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-bold font-mono">{avg7 || '–'}</p>
                  <p className="text-xs text-muted-foreground">7d avg</p>
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardContent className="pt-4">
                <WeightChart entries={weightEntries} targetWeight={profile?.target_weight} />
              </CardContent>
            </Card>
          </section>

          {/* ── Nutrition Section ── */}
          <section className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground">nutrition</h2>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">avg. daily calories</p>
                    <p className="text-3xl font-bold font-mono">{avgCalories || '–'}</p>
                  </div>
                  {calorieTrend !== 0 && (
                    <div className={`flex items-center gap-1 text-sm font-mono ${calorieTrend > 0 ? 'text-rose-500' : 'text-green-500'}`}>
                      {calorieTrend > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                      {calorieTrend > 0 ? '+' : ''}{calorieTrend}%
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <CalorieChart data={dailyFood} calorieGoal={profile?.calorie_goal ?? 2000} />
              </CardContent>
            </Card>

            {dailyFood.length > 0 && (
              <Card>
                <CardContent className="p-4 space-y-3">
                  <p className="text-xs text-muted-foreground">avg. daily macros</p>
                  <MacroBar label="protein" current={avgProtein} goal={profile?.protein_goal ?? 150} color="#004AC2" />
                  <MacroBar label="carbs" current={avgCarbs} goal={profile?.carbs_goal ?? 250} color="#0096FF" />
                  <MacroBar label="fat" current={avgFat} goal={profile?.fat_goal ?? 70} color="#2DCAEF" />
                </CardContent>
              </Card>
            )}
          </section>

          {/* ── Strength Radar Section ── */}
          <section className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground">strength</h2>
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">total {radarMode}</CardTitle>
                  <div className="flex rounded-md border border-[#292929] overflow-hidden">
                    <button
                      onClick={() => setRadarMode('sets')}
                      className={`px-3 py-1 text-xs transition-colors ${radarMode === 'sets' ? 'bg-[#2626FF] text-white' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      sets
                    </button>
                    <button
                      onClick={() => setRadarMode('reps')}
                      className={`px-3 py-1 text-xs transition-colors ${radarMode === 'reps' ? 'bg-[#2626FF] text-white' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      reps
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <MuscleRadarChart sets={sets} mode={radarMode} />
              </CardContent>
            </Card>
          </section>

          {/* ── Progression Section (per exercise) ── */}
          <section className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground">progression</h2>

            {/* Category filter */}
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              <button
                onClick={() => setCategory('all')}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors whitespace-nowrap shrink-0 ${category === 'all' ? 'bg-[#2626FF] text-white' : 'bg-[#1E1E1E] text-muted-foreground hover:text-foreground'}`}
              >
                all
              </button>
              {workoutCategories.map((name) => (
                <button
                  key={name}
                  onClick={() => setCategory(name)}
                  className={`px-3 py-1.5 text-xs rounded-md transition-colors whitespace-nowrap shrink-0 ${category === name ? 'bg-[#2626FF] text-white' : 'bg-[#1E1E1E] text-muted-foreground hover:text-foreground'}`}
                >
                  {name}
                </button>
              ))}
            </div>

            {filteredExercises.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-muted-foreground text-sm">
                no exercise data for this period.
              </div>
            ) : (
              <div className="space-y-3">
                {(showAllExercises ? filteredExercises : filteredExercises.slice(0, 5)).map((name) => (
                  <Card key={name}>
                    <CardContent className="pt-3 pb-2">
                      <ExerciseProgressionChart
                        exerciseName={name}
                        workouts={workouts}
                        sets={sets}
                      />
                    </CardContent>
                  </Card>
                ))}
                {filteredExercises.length > 5 && (
                  <Button
                    variant="ghost"
                    className="w-full text-xs text-muted-foreground"
                    onClick={() => setShowAllExercises(!showAllExercises)}
                  >
                    {showAllExercises ? 'show less' : `show all ${filteredExercises.length} exercises`}
                  </Button>
                )}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function MacroBar({ label, current, goal, color }: { label: string; current: number; goal: number; color: string }) {
  const pct = Math.min((current / goal) * 100, 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono">{current}/{goal}g</span>
      </div>
      <div className="h-2 rounded-full bg-[#1E1E1E] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
