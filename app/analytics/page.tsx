'use client';

import { Suspense, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import dynamic from 'next/dynamic';
import { useAuth, useWeightEntries, useProfile, useAnalyticsWorkouts, useAnalyticsFood, useGarminData, useAppleHealthData } from '@/lib/hooks';
import type { GarminHealthEntry, AppleHealthEntry } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FriendsSection } from '@/components/FriendsSection';

const WeightChart = dynamic(() => import('@/components/WeightChart').then(m => ({ default: m.WeightChart })), { ssr: false });
const CalorieChart = dynamic(() => import('@/components/CalorieChart').then(m => ({ default: m.CalorieChart })), { ssr: false });
const MuscleRadarChart = dynamic(() => import('@/components/MuscleRadarChart').then(m => ({ default: m.MuscleRadarChart })), { ssr: false });
const ExerciseProgressionChart = dynamic(() => import('@/components/ExerciseProgressionChart').then(m => ({ default: m.ExerciseProgressionChart })), { ssr: false });
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingDown, TrendingUp, Minus, Loader2, Footprints, Heart, Activity, Moon, MapPin, ChevronLeft, ChevronRight } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

type TimeRange = '7' | '30' | '90' | '365';
type Category = string; // 'all' or a workout name

type AnalyticsTab = 'data' | 'friends';

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center text-muted-foreground">loading...</div>}>
      <AnalyticsContent />
    </Suspense>
  );
}

function AnalyticsContent() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') === 'friends' ? 'friends' : 'data';
  const [activeTab, setActiveTab] = useState<AnalyticsTab>(initialTab);
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
        {activeTab === 'data' && (
          <Tabs value={range} onValueChange={(v) => setRange(v as TimeRange)}>
            <TabsList className="h-8">
              <TabsTrigger value="7" className="text-xs px-2 h-6">7d</TabsTrigger>
              <TabsTrigger value="30" className="text-xs px-2 h-6">30d</TabsTrigger>
              <TabsTrigger value="90" className="text-xs px-2 h-6">90d</TabsTrigger>
              <TabsTrigger value="365" className="text-xs px-2 h-6">1y</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </div>

      {/* Data / Friends Tab Selector */}
      <div className="flex rounded-md border border-[#292929] overflow-hidden">
        <button
          onClick={() => setActiveTab('data')}
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'data' ? 'bg-[#2626FF] text-white' : 'text-muted-foreground hover:text-foreground'}`}
        >
          data
        </button>
        <button
          onClick={() => setActiveTab('friends')}
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'friends' ? 'bg-[#2626FF] text-white' : 'text-muted-foreground hover:text-foreground'}`}
        >
          friends
        </button>
      </div>

      {activeTab === 'friends' && <FriendsSection />}

      {activeTab === 'data' && isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {activeTab === 'data' && !isLoading && (
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
  type StepsView = 'D' | 'W' | 'M';
  const [stepsView, setStepsView] = useState<StepsView>('W');
  const [dayOffset, setDayOffset] = useState(0);
  const [nightIdx, setNightIdx] = useState(0);

  const types = new Set(entries.map(e => e.type));
  const chartTooltipStyle = { backgroundColor: '#0F0F0F', border: '1px solid #292929', borderRadius: 6, fontSize: 12 };

  // ── Steps data ──
  const stepEntries = useMemo(() => entries.filter(e => e.type === 'steps'), [entries]);

  const sortedStepDays = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of stepEntries) {
      const date = format(parseHealthDate(e.start_date), 'yyyy-MM-dd');
      map.set(date, (map.get(date) || 0) + (parseFloat(e.value) || 0));
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, steps]) => ({ date, steps: Math.round(steps) }));
  }, [stepEntries]);

  // Daily view: selected day
  const selectedDay = sortedStepDays.length > 0
    ? sortedStepDays[Math.max(0, sortedStepDays.length - 1 - dayOffset)]
    : null;

  const hourlyData = useMemo(() => {
    if (!selectedDay) return [];
    const dayStr = selectedDay.date;
    const filtered = stepEntries.filter(e => format(parseHealthDate(e.start_date), 'yyyy-MM-dd') === dayStr);
    const hourMap = new Map<number, number>();
    for (const e of filtered) {
      const h = parseHealthDate(e.start_date).getHours();
      hourMap.set(h, (hourMap.get(h) || 0) + (parseFloat(e.value) || 0));
    }
    return Array.from({ length: 24 }, (_, i) => ({
      label: String(i),
      steps: Math.round(hourMap.get(i) || 0),
    }));
  }, [stepEntries, selectedDay]);

  const weeklyData = useMemo(() =>
    sortedStepDays.slice(-7).map(d => ({ label: d.date.slice(5), steps: d.steps })),
    [sortedStepDays]
  );

  const monthlyData = useMemo(() =>
    sortedStepDays.map(d => ({ label: d.date.slice(5), steps: d.steps })),
    [sortedStepDays]
  );

  const stepsChart = stepsView === 'D' ? hourlyData : stepsView === 'W' ? weeklyData : monthlyData;
  const stepsKPI = stepsView === 'D'
    ? (selectedDay?.steps || 0)
    : stepsChart.length > 0 ? Math.round(stepsChart.reduce((s, d) => s + d.steps, 0) / stepsChart.length) : 0;
  const stepsKPILabel = stepsView === 'D' ? 'total steps' : 'avg. steps/day';

  const hasSteps = types.has('steps') && sortedStepDays.length > 0;

  // ── Sleep data ──
  const sleepNights = useMemo(() => {
    const sleepEntries = entries.filter(e => e.type === 'sleep')
      .map(e => ({ ...e, parsed: parseHealthDate(e.start_date) }))
      .sort((a, b) => a.parsed.getTime() - b.parsed.getTime());

    if (sleepEntries.length === 0) return [];

    const nights: (typeof sleepEntries)[] = [];
    let current: typeof sleepEntries = [];

    for (const entry of sleepEntries) {
      if (current.length === 0) {
        current.push(entry);
      } else {
        const gap = entry.parsed.getTime() - current[current.length - 1].parsed.getTime();
        if (gap > 4 * 60 * 60 * 1000) {
          if (current.length >= 3) nights.push(current);
          current = [entry];
        } else {
          current.push(entry);
        }
      }
    }
    if (current.length >= 3) nights.push(current);

    return nights.map(night => {
      const segments: { phase: 'awake' | 'rem' | 'core' | 'deep'; startTime: Date; endTime: Date; durationMin: number }[] = [];
      for (let i = 0; i < night.length; i++) {
        const start = night[i].parsed;
        const end = i < night.length - 1
          ? night[i + 1].parsed
          : new Date(start.getTime() + 5 * 60 * 1000);
        segments.push({
          phase: night[i].value.toLowerCase() as 'awake' | 'rem' | 'core' | 'deep',
          startTime: start,
          endTime: end,
          durationMin: (end.getTime() - start.getTime()) / (1000 * 60),
        });
      }

      const nightStart = night[0].parsed;
      const nightEnd = segments[segments.length - 1].endTime;
      const asleepMin = segments
        .filter(s => s.phase !== 'awake')
        .reduce((s, seg) => s + seg.durationMin, 0);

      const phaseMin = { awake: 0, rem: 0, core: 0, deep: 0 };
      for (const seg of segments) phaseMin[seg.phase] += seg.durationMin;

      return {
        date: format(nightStart, 'yyyy-MM-dd'),
        label: format(nightStart, 'EEE, d MMM'),
        nightStart,
        nightEnd,
        asleepMin,
        phaseMin,
        segments,
      };
    }).reverse();
  }, [entries]);

  const hasSleep = types.has('sleep') && sleepNights.length > 0;
  const currentNight = hasSleep ? sleepNights[Math.min(nightIdx, sleepNights.length - 1)] : null;

  // ── HR data ──
  const dailyHR = useMemo(() => {
    const hrEntries = entries.filter(e => e.type === 'heart_rate_bpm');
    if (hrEntries.length === 0) return [];
    const map = new Map<string, { sum: number; count: number }>();
    for (const e of hrEntries) {
      const date = format(parseHealthDate(e.start_date), 'yyyy-MM-dd');
      const val = parseFloat(e.value) || 0;
      const prev = map.get(date);
      if (prev) { prev.sum += val; prev.count += 1; }
      else map.set(date, { sum: val, count: 1 });
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, { sum, count }]) => ({ date: date.slice(5), avg: Math.round(sum / count) }));
  }, [entries]);

  const allHrValues = useMemo(() =>
    entries.filter(e => e.type === 'heart_rate_bpm').map(e => parseFloat(e.value)).filter(v => !isNaN(v)),
    [entries]
  );
  const hasHR = types.has('heart_rate_bpm') && dailyHR.length > 0;
  const avgHr = allHrValues.length > 0 ? Math.round(allHrValues.reduce((s, v) => s + v, 0) / allHrValues.length) : 0;
  const minHr = allHrValues.length > 0 ? Math.round(Math.min(...allHrValues)) : 0;
  const maxHr = allHrValues.length > 0 ? Math.round(Math.max(...allHrValues)) : 0;

  // ── HRV data ──
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
  const hasHRV = types.has('hrv_ms') && dailyHRV.length > 0;
  const avgHRV = hasHRV ? Math.round(dailyHRV.reduce((s, d) => s + d.hrv, 0) / dailyHRV.length) : 0;

  // ── Distance data ──
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
  const hasDistance = types.has('walking_running_distance') && dailyDistance.length > 0;
  const avgDist = hasDistance ? Math.round(dailyDistance.reduce((s, d) => s + d.km, 0) / dailyDistance.length * 100) / 100 : 0;

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium text-muted-foreground">apple health</h2>

      {/* ── Steps ── */}
      {hasSteps && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Footprints className="h-4 w-4 text-[#2DCAEF]" />
                <span className="text-sm font-medium">steps</span>
              </div>
              <div className="flex rounded-md border border-[#292929] overflow-hidden">
                {(['D', 'W', 'M'] as const).map(v => (
                  <button
                    key={v}
                    onClick={() => { setStepsView(v); setDayOffset(0); }}
                    className={`px-2.5 py-1 text-xs transition-colors ${stepsView === v ? 'bg-[#2DCAEF] text-white' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {stepsView === 'D' && selectedDay && (
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={() => setDayOffset(Math.min(dayOffset + 1, sortedStepDays.length - 1))}
                  className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                  disabled={dayOffset >= sortedStepDays.length - 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-xs text-muted-foreground">{format(new Date(selectedDay.date + 'T12:00:00'), 'EEE, d MMM')}</span>
                <button
                  onClick={() => setDayOffset(Math.max(0, dayOffset - 1))}
                  className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                  disabled={dayOffset === 0}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}

            <div>
              <p className="text-3xl font-bold font-mono">{stepsKPI.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">{stepsKPILabel}</p>
            </div>

            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={stepsChart} margin={{ top: 0, right: 0, left: -24, bottom: 0 }}>
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#d4d4d4', fontSize: 9 }}
                  tickLine={false}
                  axisLine={false}
                  interval={stepsView === 'D' ? 5 : 'preserveStartEnd'}
                />
                <YAxis tick={{ fill: '#d4d4d4', fontSize: 9 }} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={false}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.[0]) return null;
                    const val = payload[0].value as number;
                    return (
                      <div style={{ backgroundColor: '#0F0F0F', border: '1px solid #292929', borderRadius: 6, padding: '6px 10px' }}>
                        <p style={{ color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: 'monospace' }}>{val.toLocaleString()} steps</p>
                        <p style={{ color: '#888', fontSize: 10 }}>{stepsView === 'D' ? `${label}:00` : label}</p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="steps" fill="#2DCAEF" radius={[2, 2, 0, 0]} activeBar={{ fill: '#5dd9f5' }} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* ── Sleep ── */}
      {hasSleep && currentNight && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Moon className="h-4 w-4 text-[#A78BFA]" />
                <span className="text-sm font-medium">sleep</span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => setNightIdx(Math.min(nightIdx + 1, sleepNights.length - 1))}
                className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                disabled={nightIdx >= sleepNights.length - 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs text-muted-foreground">{currentNight.label}</span>
              <button
                onClick={() => setNightIdx(Math.max(0, nightIdx - 1))}
                className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                disabled={nightIdx === 0}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div>
              <p className="text-[10px] text-muted-foreground">time asleep</p>
              <p className="text-2xl font-bold font-mono">
                {Math.floor(currentNight.asleepMin / 60)}h {Math.round(currentNight.asleepMin % 60)}min
              </p>
            </div>

            <SleepStageChart
              segments={currentNight.segments}
              nightStart={currentNight.nightStart}
              nightEnd={currentNight.nightEnd}
            />

            <div className="grid grid-cols-4 gap-1">
              {([
                { key: 'deep', label: 'Deep', color: '#3B82F6' },
                { key: 'core', label: 'Core', color: '#60A5FA' },
                { key: 'rem', label: 'REM', color: '#A78BFA' },
                { key: 'awake', label: 'Awake', color: '#F87171' },
              ] as const).map(({ key, label, color }) => {
                const mins = currentNight.phaseMin[key];
                return (
                  <div key={key} className="text-center">
                    <div className="w-2 h-2 rounded-sm mx-auto mb-1" style={{ backgroundColor: color }} />
                    <p className="text-xs font-mono">
                      {mins >= 60 ? `${Math.floor(mins / 60)}h ${Math.round(mins % 60)}m` : `${Math.round(mins)}m`}
                    </p>
                    <p className="text-[9px] text-muted-foreground">{label}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Heart Rate ── */}
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

      {/* ── HRV ── */}
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

      {/* ── Distance ── */}
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
                    <Tooltip
                      cursor={false}
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.[0]) return null;
                        const val = payload[0].value as number;
                        return (
                          <div style={{ backgroundColor: '#0F0F0F', border: '1px solid #292929', borderRadius: 6, padding: '6px 10px' }}>
                            <p style={{ color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: 'monospace' }}>{val} km</p>
                            <p style={{ color: '#888', fontSize: 10 }}>{label}</p>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="km" fill="#2DCAEF" radius={[2, 2, 0, 0]} activeBar={{ fill: '#5dd9f5' }} />
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

function SleepStageChart({ segments, nightStart, nightEnd }: {
  segments: Array<{ phase: string; startTime: Date; endTime: Date; durationMin: number }>;
  nightStart: Date;
  nightEnd: Date;
}) {
  const totalMs = nightEnd.getTime() - nightStart.getTime();
  if (totalMs <= 0) return null;

  const phaseColors: Record<string, string> = {
    awake: '#F87171', rem: '#A78BFA', core: '#60A5FA', deep: '#3B82F6',
  };
  const phases = ['awake', 'rem', 'core', 'deep'] as const;

  return (
    <div>
      <div className="flex gap-2">
        <div className="flex flex-col justify-around text-[9px] text-muted-foreground shrink-0 w-10 py-0.5">
          {phases.map(p => (
            <span key={p}>{p === 'awake' ? 'Awake' : p === 'rem' ? 'REM' : p.charAt(0).toUpperCase() + p.slice(1)}</span>
          ))}
        </div>
        <div className="flex-1">
          {phases.map(phase => (
            <div key={phase} className="relative h-6">
              {segments
                .filter(s => s.phase === phase)
                .map((seg, i) => {
                  const left = ((seg.startTime.getTime() - nightStart.getTime()) / totalMs) * 100;
                  const width = ((seg.endTime.getTime() - seg.startTime.getTime()) / totalMs) * 100;
                  return (
                    <div
                      key={i}
                      className="absolute top-0.5 bottom-0.5 rounded-[2px]"
                      style={{
                        left: `${left}%`,
                        width: `${Math.max(width, 0.3)}%`,
                        backgroundColor: phaseColors[phase],
                      }}
                    />
                  );
                })}
            </div>
          ))}
          <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
            <span>{format(nightStart, 'HH:mm')}</span>
            <span>{format(nightEnd, 'HH:mm')}</span>
          </div>
        </div>
      </div>
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
