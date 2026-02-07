'use client';

import { useState, useEffect } from 'react';
import { format, startOfWeek, addDays } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { useAuth, useFoodEntries, useWeightEntries, useWorkouts, useProfile } from '@/lib/hooks';
import { MacroRings } from '@/components/MacroRings';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dumbbell, Scale, Utensils, TrendingUp, User, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const { user, loading: authLoading } = useAuth();
  const { profile } = useProfile();
  const router = useRouter();
  const today = format(new Date(), 'yyyy-MM-dd');
  const { entries: todayEntries } = useFoodEntries(today);
  const { entries: weightEntries } = useWeightEntries(30);
  const { workouts } = useWorkouts();
  const [weeklyFood, setWeeklyFood] = useState<Map<number, number>>(new Map());
  const [weeklyWorkouts, setWeeklyWorkouts] = useState<Map<number, string>>(new Map());
  const [weeklyWeight, setWeeklyWeight] = useState<Map<number, number>>(new Map());
  const [weightDialogOpen, setWeightDialogOpen] = useState(false);
  const [quickWeight, setQuickWeight] = useState('');
  const [savingWeight, setSavingWeight] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, authLoading, router]);

  // Calculate weekly consistency
  useEffect(() => {
    if (!user) return;
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekEnd = addDays(weekStart, 6);
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      dates.push(format(addDays(weekStart, i), 'yyyy-MM-dd'));
    }

    function dateToDayIdx(dateStr: string) {
      const d = new Date(dateStr + 'T12:00:00');
      return (d.getDay() + 6) % 7; // Mon=0 ... Sun=6
    }

    // Food: calories per day
    supabase
      .from('food_entries')
      .select('date, calories')
      .eq('user_id', user.id)
      .in('date', dates)
      .then(({ data }) => {
        if (data) {
          const map = new Map<number, number>();
          for (const e of data) {
            const idx = dateToDayIdx(e.date);
            map.set(idx, (map.get(idx) || 0) + e.calories);
          }
          setWeeklyFood(map);
        }
      });

    // Workouts per day
    supabase
      .from('workouts')
      .select('date, name')
      .eq('user_id', user.id)
      .gte('date', format(weekStart, 'yyyy-MM-dd'))
      .lte('date', format(weekEnd, 'yyyy-MM-dd'))
      .order('date')
      .then(({ data }) => {
        if (data) {
          const map = new Map<number, string>();
          for (const w of data) {
            map.set(dateToDayIdx(w.date), w.name || 'Gym');
          }
          setWeeklyWorkouts(map);
        }
      });

    // Weight per day
    supabase
      .from('weight_entries')
      .select('date, weight_kg')
      .eq('user_id', user.id)
      .in('date', dates)
      .then(({ data }) => {
        if (data) {
          const map = new Map<number, number>();
          for (const w of data) {
            map.set(dateToDayIdx(w.date), w.weight_kg);
          }
          setWeeklyWeight(map);
        }
      });
  }, [user]);

  const totals = todayEntries.reduce(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      protein: acc.protein + e.protein,
      carbs: acc.carbs + e.carbs,
      fat: acc.fat + e.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const latestWeight = weightEntries.length > 0 ? weightEntries[weightEntries.length - 1] : null;
  const lastWorkout = workouts.length > 0 ? workouts[0] : null;

  async function handleQuickWeight() {
    if (!user || !quickWeight) return;
    setSavingWeight(true);
    await supabase.from('weight_entries').upsert(
      {
        user_id: user.id,
        date: format(new Date(), 'yyyy-MM-dd'),
        weight_kg: parseFloat(quickWeight),
      },
      { onConflict: 'user_id,date' }
    );
    setSavingWeight(false);
    setWeightDialogOpen(false);
    setQuickWeight('');
  }

  if (authLoading) {
    return <div className="flex h-screen items-center justify-center"><span className="text-muted-foreground">loading...</span></div>;
  }

  return (
    <div className="mx-auto max-w-md p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-[0.15em]">
            {profile?.display_name ? `hey, ${profile.display_name}` : 'TRÆCK'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </p>
        </div>
        <Link href="/profile" className="h-9 w-9 rounded-full bg-[#0F0F0F] border border-[#292929] flex items-center justify-center shrink-0 mt-0.5">
          <User className="h-4 w-4 text-muted-foreground" />
        </Link>
      </div>

      {/* Calorie Overview */}
      {profile && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">today</CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      )}


      {/* Quick Add */}
      <div className="grid grid-cols-3 gap-2">
        <Button className="h-14 flex-col gap-1" variant="outline" onClick={() => router.push('/food/add')}>
          <div className="flex items-center gap-1">
            <Plus className="h-3.5 w-3.5" />
            <Utensils className="h-4 w-4" />
          </div>
          <span className="text-[10px]">food</span>
        </Button>
        <Button className="h-14 flex-col gap-1" variant="outline" onClick={() => router.push('/workout')}>
          <div className="flex items-center gap-1">
            <Plus className="h-3.5 w-3.5" />
            <Dumbbell className="h-4 w-4" />
          </div>
          <span className="text-[10px]">workout</span>
        </Button>
        <Button className="h-14 flex-col gap-1" variant="outline" onClick={() => setWeightDialogOpen(true)}>
          <div className="flex items-center gap-1">
            <Plus className="h-3.5 w-3.5" />
            <Scale className="h-4 w-4" />
          </div>
          <span className="text-[10px]">weight</span>
        </Button>
      </div>

      {/* Weight Quick Add Dialog */}
      <Dialog open={weightDialogOpen} onOpenChange={setWeightDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>log weight</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                step="0.1"
                placeholder={latestWeight ? `${latestWeight.weight_kg}` : '75.0'}
                value={quickWeight}
                onChange={(e) => setQuickWeight(e.target.value)}
                className="text-lg font-mono"
                autoFocus
              />
              <span className="text-muted-foreground text-sm">kg</span>
            </div>
            <Button
              className="w-full"
              onClick={handleQuickWeight}
              disabled={!quickWeight || savingWeight}
            >
              {savingWeight ? 'saving...' : 'save'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Weekly Consistency */}
      {(() => {
        const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const foodDays = weeklyFood.size;
        return (
          <Card>
            <CardContent className="p-4 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium flex items-center gap-1.5">
                    <TrendingUp className="h-4 w-4 text-white" />
                    nutrition
                  </span>
                  <span className="text-xs text-muted-foreground">{foodDays}/7 days</span>
                </div>
                <div className="flex gap-1.5">
                  {dayLabels.map((label, i) => {
                    const kcal = weeklyFood.get(i);
                    return (
                      <div key={i} className="flex-1 text-center space-y-1">
                        <div className={`h-7 rounded-[5px] flex items-center justify-center border border-[#292929] ${kcal ? 'bg-[#2626FF]' : 'bg-[#222222]'}`}>
                          {kcal ? (
                            <span className="text-xs font-extrabold text-white font-mono">{Math.round(kcal)}</span>
                          ) : null}
                        </div>
                        <span className="text-[9px] text-muted-foreground">{label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium flex items-center gap-1.5">
                    <Dumbbell className="h-4 w-4 text-white" />
                    training
                  </span>
                  <span className="text-xs text-muted-foreground">{weeklyWorkouts.size}x this week</span>
                </div>
                <div className="flex gap-1.5">
                  {dayLabels.map((label, i) => {
                    const name = weeklyWorkouts.get(i);
                    return (
                      <div key={i} className="flex-1 text-center space-y-1">
                        <div className={`h-7 rounded-[5px] flex items-center justify-center border border-[#292929] ${name ? 'bg-[#2626FF]' : 'bg-[#222222]'}`}>
                          {name ? (
                            <span className="text-xs font-extrabold text-white truncate px-1">{name.replace(' Day', '')}</span>
                          ) : null}
                        </div>
                        <span className="text-[9px] text-muted-foreground">{label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium flex items-center gap-1.5">
                    <Scale className="h-4 w-4 text-white" />
                    weight
                  </span>
                  <span className="text-xs text-muted-foreground">{weeklyWeight.size}/7 days</span>
                </div>
                <div className="flex gap-1.5">
                  {dayLabels.map((label, i) => {
                    const kg = weeklyWeight.get(i);
                    return (
                      <div key={i} className="flex-1 text-center space-y-1">
                        <div className={`h-7 rounded-[5px] flex items-center justify-center border border-[#292929] ${kg ? 'bg-[#2626FF]' : 'bg-[#222222]'}`}>
                          {kg ? (
                            <span className="text-xs font-extrabold text-white font-mono">{kg}</span>
                          ) : null}
                        </div>
                        <span className="text-[9px] text-muted-foreground">{label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}
    </div>
  );
}
