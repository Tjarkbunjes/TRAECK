'use client';

import { useState, useEffect } from 'react';
import { format, startOfWeek, addDays } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { useAuth, useFoodEntries, useWeightEntries, useWorkouts, useProfile } from '@/lib/hooks';
import { MacroRings } from '@/components/MacroRings';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dumbbell, Scale, Utensils, TrendingUp, Users } from 'lucide-react';
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

  if (authLoading) {
    return <div className="flex h-screen items-center justify-center"><span className="text-muted-foreground">loading...</span></div>;
  }

  return (
    <div className="mx-auto max-w-md p-4 space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-[0.15em]">
          {profile?.display_name ? `hey, ${profile.display_name}` : 'TRÆCK'}
        </h1>
        <p className="text-sm text-muted-foreground">
          {format(new Date(), 'EEEE, MMMM d, yyyy')}
        </p>
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


      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-2">
        <Button asChild className="h-14" variant="outline">
          <Link href="/food/add">
            <Utensils className="mr-2 h-5 w-5" />
            log food
          </Link>
        </Button>
        <Button asChild className="h-14" variant="outline">
          <Link href="/workout">
            <Dumbbell className="mr-2 h-5 w-5" />
            workout
          </Link>
        </Button>
        <Button asChild className="h-14" variant="outline">
          <Link href="/weight">
            <Scale className="mr-2 h-5 w-5" />
            weight
          </Link>
        </Button>
        <Button className="h-14 flex-col gap-0" variant="outline" disabled>
          <Users className="h-5 w-5" />
          <span>friends</span>
          <span className="text-[9px] text-muted-foreground">coming soon</span>
        </Button>
      </div>

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
                        <div className={`h-7 rounded-md flex items-center justify-center border ${kcal ? 'bg-muted/50 border-border' : 'bg-muted/20 border-transparent'}`}>
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
                        <div className={`h-7 rounded-md flex items-center justify-center border ${name ? 'bg-muted/50 border-border' : 'bg-muted/20 border-transparent'}`}>
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
            </CardContent>
          </Card>
        );
      })()}
    </div>
  );
}
