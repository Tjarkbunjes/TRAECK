'use client';

import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import dynamic from 'next/dynamic';
import { useAuth, useWeightEntries, useProfile, useAnalyticsWorkouts, useAnalyticsFood, useGarminData, useAppleHealthData } from '@/lib/hooks';
import type { GarminHealthEntry, AppleHealthEntry } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const WeightChart = dynamic(() => import('@/components/WeightChart').then(m => ({ default: m.WeightChart })), { ssr: false });
const CalorieChart = dynamic(() => import('@/components/CalorieChart').then(m => ({ default: m.CalorieChart })), { ssr: false });
const MuscleRadarChart = dynamic(() => import('@/components/MuscleRadarChart').then(m => ({ default: m.MuscleRadarChart })), { ssr: false });
const ExerciseProgressionChart = dynamic(() => import('@/components/ExerciseProgressionChart').then(m => ({ default: m.ExerciseProgressionChart })), { ssr: false });
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingDown, TrendingUp, Minus, Loader2, Footprints, Heart, Activity, Moon, MapPin } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

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
  const { entries: garminEntries, loading: garminLoading } = useGarminData(days);
  const { entries: healthEntries, loading: healthLoading } = useAppleHealthData(days);

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

  // Nutrition stats — exclude today (incomplete)
  const today = new Date().toISOString().slice(0, 10);
  const completedFood = dailyFood.filter(d => d.date < today);

  const avgCalories = completedFood.length > 0
    ? Math.round(completedFood.reduce((s, d) => s + d.calories, 0) / completedFood.length)
    : 0;
  const avgProtein = completedFood.length > 0
    ? Math.round(completedFood.reduce((s, d) => s + d.protein, 0) / completedFood.length)
    : 0;
  const avgCarbs = completedFood.length > 0
    ? Math.round(completedFood.reduce((s, d) => s + d.carbs, 0) / completedFood.length)
    : 0;
  const avgFat = completedFood.length > 0
    ? Math.round(completedFood.reduce((s, d) => s + d.fat, 0) / completedFood.length)
    : 0;

  // Calorie trend — exclude today
  const calorieTrend = useMemo(() => {
    const completed = dailyFood.filter(d => d.date < today);
    if (completed.length < 2) return 0;
    const sorted = [...completed].sort((a, b) => a.date.localeCompare(b.date));
    const recentDays = sorted.slice(-7);
    const prevDays = sorted.slice(-14, -7);
    if (prevDays.length === 0 || recentDays.length === 0) return 0;
    const recentAvg = recentDays.reduce((s, d) => s + d.calories, 0) / recentDays.length;
    const prevAvg = prevDays.reduce((s, d) => s + d.calories, 0) / prevDays.length;
    if (prevAvg === 0) return 0;
    return Math.round(((recentAvg - prevAvg) / prevAvg) * 100);
  }, [dailyFood, today]);

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

    // Group by exercise, track muscle group + volume
    const exerciseMap = new Map<string, { muscle: string; vol: number }>();
    for (const s of filtered) {
      const prev = exerciseMap.get(s.exercise_name);
      const vol = (s.weight_kg ?? 0) * (s.reps ?? 0);
      exerciseMap.set(s.exercise_name, {
        muscle: prev?.muscle || s.muscle_group?.toLowerCase() || '',
        vol: (prev?.vol ?? 0) + vol,
      });
    }

    // Sort by muscle group order, then by volume within group
    const muscleOrder: Record<string, number> = { chest: 0, back: 1, shoulders: 2, legs: 3, arms: 4, core: 5, cardio: 6 };
    return Array.from(exerciseMap.entries())
      .sort((a, b) => {
        const ma = muscleOrder[a[1].muscle] ?? 99;
        const mb = muscleOrder[b[1].muscle] ?? 99;
        if (ma !== mb) return ma - mb;
        return b[1].vol - a[1].vol;
      })
      .map(([name]) => name);
  }, [sets, category, workouts]);

  const isLoading = weightLoading || workoutLoading || foodLoading || garminLoading || healthLoading;

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

          {/* ── Heart Rate Section ── */}
          {garminEntries.length > 0 && (() => {
            const withHr = garminEntries.filter(e => e.resting_hr !== null);
            if (withHr.length === 0) return null;

            const avgHr = Math.round(withHr.reduce((s, e) => s + (e.resting_hr ?? 0), 0) / withHr.length);
            const minHr = Math.min(...withHr.map(e => e.resting_hr ?? 0));
            const maxHr = Math.max(...withHr.map(e => e.resting_hr ?? 0));

            const hrChartData = withHr.map(e => ({
              date: e.date.slice(5),
              hr: e.resting_hr,
            }));

            return (
              <section className="space-y-2">
                <h2 className="text-sm font-medium text-muted-foreground">heart rate</h2>

                <div className="grid grid-cols-3 gap-2">
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-2xl font-bold font-mono">{avgHr}</p>
                      <p className="text-xs text-muted-foreground">avg resting</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-2xl font-bold font-mono">{minHr}</p>
                      <p className="text-xs text-muted-foreground">lowest</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-2xl font-bold font-mono">{maxHr}</p>
                      <p className="text-xs text-muted-foreground">highest</p>
                    </CardContent>
                  </Card>
                </div>

                {hrChartData.length > 1 && (
                  <Card>
                    <CardContent className="pt-4">
                      <GarminHRChart data={hrChartData} />
                    </CardContent>
                  </Card>
                )}

                <GarminIntradaySection entries={garminEntries} />
              </section>
            );
          })()}

          {/* ── Apple Health Section ── */}
          {healthEntries.length > 0 && (
            <AppleHealthSection entries={healthEntries} />
          )}

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

function GarminIntradaySection({ entries }: { entries: GarminHealthEntry[] }) {
  const withIntraday = entries.filter(e => e.hr_values && e.hr_values.length > 0);
  const [selectedDate, setSelectedDate] = useState(withIntraday[withIntraday.length - 1]?.date ?? '');

  if (withIntraday.length === 0) return null;

  const selectedEntry = withIntraday.find(e => e.date === selectedDate);
  const chartData = (selectedEntry?.hr_values ?? []).map(({ t, hr }) => ({
    time: new Date(t).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
    hr,
  }));

  return (
    <Card>
      <CardContent className="pt-4 space-y-2">
        <p className="text-xs text-muted-foreground">intraday heart rate</p>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {withIntraday.map(e => (
            <button
              key={e.date}
              onClick={() => setSelectedDate(e.date)}
              className={`px-2 py-1 text-xs rounded-md whitespace-nowrap shrink-0 transition-colors ${selectedDate === e.date ? 'bg-[#2626FF] text-white' : 'bg-[#1E1E1E] text-muted-foreground hover:text-foreground'}`}
            >
              {e.date.slice(5)}
            </button>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={chartData} margin={{ top: 4, right: 0, left: -24, bottom: 0 }}>
            <XAxis
              dataKey="time"
              tick={{ fill: '#d4d4d4', fontSize: 9 }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: '#d4d4d4', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              domain={['auto', 'auto']}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#0F0F0F', border: '1px solid #292929', borderRadius: 6, fontSize: 12 }}
              labelStyle={{ color: '#d4d4d4' }}
              formatter={(v: number | undefined) => [v ?? '–', 'bpm']}
            />
            <Line
              type="monotone"
              dataKey="hr"
              stroke="#2DCAEF"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 2, fill: '#2DCAEF' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function GarminHRChart({ data }: { data: { date: string; hr: number | null }[] }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-2">resting heart rate (bpm)</p>
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={data} margin={{ top: 4, right: 0, left: -24, bottom: 0 }}>
          <XAxis
            dataKey="date"
            tick={{ fill: '#d4d4d4', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: '#d4d4d4', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            domain={['auto', 'auto']}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#0F0F0F', border: '1px solid #292929', borderRadius: 6, fontSize: 12 }}
            labelStyle={{ color: '#d4d4d4' }}
            formatter={(v: number | undefined) => [v ?? '–', 'bpm']}
          />
          <Line
            type="monotone"
            dataKey="hr"
            stroke="#2DCAEF"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3, fill: '#2DCAEF' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// Parse Apple Health start_date text into a Date
function parseHealthDate(raw: string): Date {
  const cleaned = raw.replace(/\.\s/, ' ').replace(' at ', ' ');
  const d = new Date(cleaned);
  if (!isNaN(d.getTime())) return d;
  return new Date(raw);
}

function AppleHealthSection({ entries }: { entries: AppleHealthEntry[] }) {
  // Group entries by type
  const types = new Set(entries.map(e => e.type));

  // Aggregate steps by day
  const dailySteps = useMemo(() => {
    const stepEntries = entries.filter(e => e.type === 'steps');
    if (stepEntries.length === 0) return [];
    const map = new Map<string, number>();
    for (const e of stepEntries) {
      const date = format(parseHealthDate(e.start_date), 'yyyy-MM-dd');
      map.set(date, (map.get(date) || 0) + (parseFloat(e.value) || 0));
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, steps]) => ({ date: date.slice(5), steps: Math.round(steps) }));
  }, [entries]);

  // Aggregate heart rate by day (average)
  const dailyHR = useMemo(() => {
    const hrEntries = entries.filter(e => e.type === 'heart_rate_bpm');
    if (hrEntries.length === 0) return [];
    const map = new Map<string, { sum: number; count: number; min: number; max: number }>();
    for (const e of hrEntries) {
      const date = format(parseHealthDate(e.start_date), 'yyyy-MM-dd');
      const val = parseFloat(e.value) || 0;
      const prev = map.get(date);
      if (prev) {
        prev.sum += val;
        prev.count += 1;
        prev.min = Math.min(prev.min, val);
        prev.max = Math.max(prev.max, val);
      } else {
        map.set(date, { sum: val, count: 1, min: val, max: val });
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, { sum, count, min, max }]) => ({
        date: date.slice(5),
        avg: Math.round(sum / count),
        min: Math.round(min),
        max: Math.round(max),
      }));
  }, [entries]);

  // Aggregate HRV by day
  const dailyHRV = useMemo(() => {
    const hrvEntries = entries.filter(e => e.type === 'hrv_ms');
    if (hrvEntries.length === 0) return [];
    const map = new Map<string, { sum: number; count: number }>();
    for (const e of hrvEntries) {
      const date = format(parseHealthDate(e.start_date), 'yyyy-MM-dd');
      const val = parseFloat(e.value) || 0;
      const prev = map.get(date);
      if (prev) { prev.sum += val; prev.count += 1; }
      else map.set(date, { sum: val, count: 1 });
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, { sum, count }]) => ({ date: date.slice(5), hrv: Math.round(sum / count) }));
  }, [entries]);

  // Aggregate distance by day
  const dailyDistance = useMemo(() => {
    const distEntries = entries.filter(e => e.type === 'walking_running_distance');
    if (distEntries.length === 0) return [];
    const map = new Map<string, number>();
    for (const e of distEntries) {
      const date = format(parseHealthDate(e.start_date), 'yyyy-MM-dd');
      map.set(date, (map.get(date) || 0) + (parseFloat(e.value) || 0));
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, dist]) => ({ date: date.slice(5), km: Math.round(dist * 100) / 100 }));
  }, [entries]);

  // Sleep phases count per day
  const dailySleep = useMemo(() => {
    const sleepEntries = entries.filter(e => e.type === 'sleep');
    if (sleepEntries.length === 0) return [];
    const map = new Map<string, { core: number; rem: number; deep: number; awake: number }>();
    for (const e of sleepEntries) {
      const date = format(parseHealthDate(e.start_date), 'yyyy-MM-dd');
      const prev = map.get(date) || { core: 0, rem: 0, deep: 0, awake: 0 };
      const phase = e.value.toLowerCase();
      if (phase === 'core') prev.core += 1;
      else if (phase === 'rem') prev.rem += 1;
      else if (phase === 'deep') prev.deep += 1;
      else if (phase === 'awake') prev.awake += 1;
      map.set(date, prev);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, phases]) => ({ date: date.slice(5), ...phases }));
  }, [entries]);

  const hasSteps = types.has('steps') && dailySteps.length > 0;
  const hasHR = types.has('heart_rate_bpm') && dailyHR.length > 0;
  const hasHRV = types.has('hrv_ms') && dailyHRV.length > 0;
  const hasDistance = types.has('walking_running_distance') && dailyDistance.length > 0;
  const hasSleep = types.has('sleep') && dailySleep.length > 0;

  // KPIs
  const avgSteps = hasSteps ? Math.round(dailySteps.reduce((s, d) => s + d.steps, 0) / dailySteps.length) : 0;

  const allHrValues = entries.filter(e => e.type === 'heart_rate_bpm').map(e => parseFloat(e.value)).filter(v => !isNaN(v));
  const avgHr = allHrValues.length > 0 ? Math.round(allHrValues.reduce((s, v) => s + v, 0) / allHrValues.length) : 0;
  const minHr = allHrValues.length > 0 ? Math.round(Math.min(...allHrValues)) : 0;
  const maxHr = allHrValues.length > 0 ? Math.round(Math.max(...allHrValues)) : 0;

  const avgHRV = hasHRV ? Math.round(dailyHRV.reduce((s, d) => s + d.hrv, 0) / dailyHRV.length) : 0;
  const avgDist = hasDistance ? Math.round(dailyDistance.reduce((s, d) => s + d.km, 0) / dailyDistance.length * 100) / 100 : 0;

  const chartTooltipStyle = { backgroundColor: '#0F0F0F', border: '1px solid #292929', borderRadius: 6, fontSize: 12 };

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium text-muted-foreground">apple health</h2>

      {/* Steps */}
      {hasSteps && (
        <>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Footprints className="h-4 w-4 text-[#2DCAEF]" />
                <p className="text-xs text-muted-foreground">avg. daily steps</p>
              </div>
              <p className="text-3xl font-bold font-mono mt-1">{avgSteps.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground mb-2">daily steps</p>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={dailySteps} margin={{ top: 4, right: 0, left: -24, bottom: 0 }}>
                  <XAxis dataKey="date" tick={{ fill: '#d4d4d4', fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fill: '#d4d4d4', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={chartTooltipStyle} labelStyle={{ color: '#d4d4d4' }} formatter={(v: number | undefined) => [(v ?? 0).toLocaleString(), 'steps']} />
                  <Bar dataKey="steps" fill="#2DCAEF" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}

      {/* Heart Rate */}
      {hasHR && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold font-mono">{avgHr}</p>
                <p className="text-xs text-muted-foreground">avg hr</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold font-mono">{minHr}</p>
                <p className="text-xs text-muted-foreground">lowest</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold font-mono">{maxHr}</p>
                <p className="text-xs text-muted-foreground">highest</p>
              </CardContent>
            </Card>
          </div>
          {dailyHR.length > 1 && (
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground mb-2">avg. heart rate (bpm)</p>
                <ResponsiveContainer width="100%" height={140}>
                  <LineChart data={dailyHR} margin={{ top: 4, right: 0, left: -24, bottom: 0 }}>
                    <XAxis dataKey="date" tick={{ fill: '#d4d4d4', fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fill: '#d4d4d4', fontSize: 10 }} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                    <Tooltip contentStyle={chartTooltipStyle} labelStyle={{ color: '#d4d4d4' }} formatter={(v: number | undefined) => [v ?? '–', 'bpm']} />
                    <Line type="monotone" dataKey="avg" stroke="#FF6B6B" strokeWidth={2} dot={false} activeDot={{ r: 3, fill: '#FF6B6B' }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* HRV */}
      {hasHRV && (
        <>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-[#51CF66]" />
                <p className="text-xs text-muted-foreground">avg. HRV</p>
              </div>
              <p className="text-3xl font-bold font-mono mt-1">{avgHRV} <span className="text-sm font-normal text-muted-foreground">ms</span></p>
            </CardContent>
          </Card>
          {dailyHRV.length > 1 && (
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground mb-2">heart rate variability (ms)</p>
                <ResponsiveContainer width="100%" height={140}>
                  <LineChart data={dailyHRV} margin={{ top: 4, right: 0, left: -24, bottom: 0 }}>
                    <XAxis dataKey="date" tick={{ fill: '#d4d4d4', fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fill: '#d4d4d4', fontSize: 10 }} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                    <Tooltip contentStyle={chartTooltipStyle} labelStyle={{ color: '#d4d4d4' }} formatter={(v: number | undefined) => [v ?? '–', 'ms']} />
                    <Line type="monotone" dataKey="hrv" stroke="#51CF66" strokeWidth={2} dot={false} activeDot={{ r: 3, fill: '#51CF66' }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Sleep */}
      {hasSleep && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Moon className="h-4 w-4 text-[#A78BFA]" />
              <p className="text-xs text-muted-foreground">sleep phases</p>
            </div>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={dailySleep} margin={{ top: 4, right: 0, left: -24, bottom: 0 }}>
                <XAxis dataKey="date" tick={{ fill: '#d4d4d4', fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fill: '#d4d4d4', fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={chartTooltipStyle} labelStyle={{ color: '#d4d4d4' }} />
                <Bar dataKey="deep" stackId="sleep" fill="#3B82F6" name="Deep" radius={[0, 0, 0, 0]} />
                <Bar dataKey="core" stackId="sleep" fill="#60A5FA" name="Core" />
                <Bar dataKey="rem" stackId="sleep" fill="#A78BFA" name="REM" />
                <Bar dataKey="awake" stackId="sleep" fill="#F87171" name="Awake" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 mt-2">
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><span className="w-2 h-2 rounded-sm bg-[#3B82F6]" />Deep</span>
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><span className="w-2 h-2 rounded-sm bg-[#60A5FA]" />Core</span>
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><span className="w-2 h-2 rounded-sm bg-[#A78BFA]" />REM</span>
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><span className="w-2 h-2 rounded-sm bg-[#F87171]" />Awake</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Distance */}
      {hasDistance && (
        <>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[#2DCAEF]" />
                <p className="text-xs text-muted-foreground">avg. daily distance</p>
              </div>
              <p className="text-3xl font-bold font-mono mt-1">{avgDist} <span className="text-sm font-normal text-muted-foreground">km</span></p>
            </CardContent>
          </Card>
          {dailyDistance.length > 1 && (
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground mb-2">daily distance (km)</p>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={dailyDistance} margin={{ top: 4, right: 0, left: -24, bottom: 0 }}>
                    <XAxis dataKey="date" tick={{ fill: '#d4d4d4', fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fill: '#d4d4d4', fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={chartTooltipStyle} labelStyle={{ color: '#d4d4d4' }} formatter={(v: number | undefined) => [v ?? '–', 'km']} />
                    <Bar dataKey="km" fill="#2DCAEF" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </section>
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
