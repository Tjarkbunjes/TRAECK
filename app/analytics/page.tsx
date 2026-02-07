'use client';

import { useState, useMemo } from 'react';
import { useAuth, useWeightEntries, useProfile, useAnalyticsWorkouts, useAnalyticsFood } from '@/lib/hooks';
import { WeightChart } from '@/components/WeightChart';
import { CalorieChart } from '@/components/CalorieChart';
import { MuscleRadarChart } from '@/components/MuscleRadarChart';
import { StrengthProgressionChart } from '@/components/StrengthProgressionChart';
import { ExerciseProgressCard } from '@/components/ExerciseProgressCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingDown, TrendingUp, Minus, Loader2 } from 'lucide-react';
import type { WorkoutSet, Workout } from '@/lib/types';

type TimeRange = '7' | '30' | '90' | '365';

export default function AnalyticsPage() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [range, setRange] = useState<TimeRange>('30');
  const days = parseInt(range);

  const { entries: weightEntries, loading: weightLoading } = useWeightEntries(days);
  const { workouts, sets, loading: workoutLoading } = useAnalyticsWorkouts(days);
  const { dailyFood, loading: foodLoading } = useAnalyticsFood(days);

  const [radarMode, setRadarMode] = useState<'volume' | 'reps'>('volume');
  const [progressionMode, setProgressionMode] = useState<'volume' | 'reps'>('volume');

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

  // Calorie trend: compare recent 7d avg to previous 7d avg
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

  // Top exercises
  const topExercises = useMemo(() => {
    if (sets.length === 0) return [];

    // Build workout date lookup
    const workoutDateMap = new Map<string, string>();
    for (const w of workouts) {
      workoutDateMap.set(w.id, w.date);
    }

    // Group sets by exercise
    const exerciseMap = new Map<string, { sets: WorkoutSet[], totalVolume: number }>();
    for (const set of sets) {
      const existing = exerciseMap.get(set.exercise_name) || { sets: [], totalVolume: 0 };
      existing.sets.push(set);
      existing.totalVolume += (set.weight_kg ?? 0) * (set.reps ?? 0);
      exerciseMap.set(set.exercise_name, existing);
    }

    return Array.from(exerciseMap.entries())
      .filter(([, data]) => data.totalVolume > 0)
      .sort((a, b) => b[1].totalVolume - a[1].totalVolume)
      .slice(0, 5)
      .map(([name, data]) => {
        const maxWeight = Math.max(...data.sets.map((s) => s.weight_kg ?? 0));

        // Sort sets by workout date for trend
        const sortedSets = [...data.sets].sort((a, b) => {
          const dateA = workoutDateMap.get(a.workout_id) || '';
          const dateB = workoutDateMap.get(b.workout_id) || '';
          return dateA.localeCompare(dateB);
        });

        const mid = Math.floor(sortedSets.length / 2);
        const firstHalfMax = mid > 0 ? Math.max(...sortedSets.slice(0, mid).map((s) => s.weight_kg ?? 0)) : 0;
        const secondHalfMax = sortedSets.length > 1 ? Math.max(...sortedSets.slice(mid).map((s) => s.weight_kg ?? 0)) : 0;
        const change = Math.round((secondHalfMax - firstHalfMax) * 10) / 10;

        // Sparkline: max weight per workout date
        const perWorkout = new Map<string, number>();
        for (const s of sortedSets) {
          const date = workoutDateMap.get(s.workout_id) || '';
          if (date) {
            perWorkout.set(date, Math.max(perWorkout.get(date) ?? 0, s.weight_kg ?? 0));
          }
        }
        const sparklineData = Array.from(perWorkout.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([, v]) => v);

        return { name, maxWeight, change, sparklineData };
      });
  }, [sets, workouts]);

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
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">weight</h2>
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
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">nutrition</h2>

            {/* Avg Calories */}
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

            {/* Calorie Chart */}
            <Card>
              <CardContent className="pt-4">
                <CalorieChart data={dailyFood} calorieGoal={profile?.calorie_goal ?? 2000} />
              </CardContent>
            </Card>

            {/* Macro Averages */}
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
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">strength</h2>
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">total {radarMode}</CardTitle>
                  <div className="flex rounded-md border border-[#292929] overflow-hidden">
                    <button
                      onClick={() => setRadarMode('volume')}
                      className={`px-3 py-1 text-xs transition-colors ${radarMode === 'volume' ? 'bg-[#2626FF] text-white' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      volume
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

          {/* ── Strength Progression Section ── */}
          <section className="space-y-2">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">progression</CardTitle>
                  <div className="flex rounded-md border border-[#292929] overflow-hidden">
                    <button
                      onClick={() => setProgressionMode('volume')}
                      className={`px-3 py-1 text-xs transition-colors ${progressionMode === 'volume' ? 'bg-[#2626FF] text-white' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      volume
                    </button>
                    <button
                      onClick={() => setProgressionMode('reps')}
                      className={`px-3 py-1 text-xs transition-colors ${progressionMode === 'reps' ? 'bg-[#2626FF] text-white' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      reps
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <StrengthProgressionChart workouts={workouts} sets={sets} mode={progressionMode} />
              </CardContent>
            </Card>
          </section>

          {/* ── Top Exercises Section ── */}
          {topExercises.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">top exercises</h2>
              <div className="space-y-2">
                {topExercises.map((ex) => (
                  <ExerciseProgressCard
                    key={ex.name}
                    name={ex.name}
                    maxWeight={ex.maxWeight}
                    change={ex.change}
                    sparklineData={ex.sparklineData}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

// Inline MacroBar component
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
