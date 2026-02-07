'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth, useWorkouts } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MUSCLE_GROUP_LABELS } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Plus, Dumbbell, FileText, Play, Trash2, ChevronDown, ChevronUp, Pencil, Zap, Copy, CalendarIcon } from 'lucide-react';
import { format, parse } from 'date-fns';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { WorkoutTemplate, WorkoutSet } from '@/lib/types';
import { DEFAULT_TEMPLATES, type DefaultTemplate } from '@/lib/default-templates';

export default function WorkoutPage() {
  const { user } = useAuth();
  const { workouts, loading, refresh } = useWorkouts();
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [expandedWorkout, setExpandedWorkout] = useState<string | null>(null);
  const [workoutSets, setWorkoutSets] = useState<Record<string, WorkoutSet[]>>({});
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [workoutDate, setWorkoutDate] = useState<Date>(new Date());
  const router = useRouter();

  useEffect(() => {
    if (!user) return;
    supabase
      .from('workout_templates')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setTemplates(data);
      });
  }, [user]);

  async function startNewWorkout() {
    if (!user) return;
    const { data, error } = await supabase
      .from('workouts')
      .insert({
        user_id: user.id,
        date: format(workoutDate, 'yyyy-MM-dd'),
      })
      .select()
      .single();

    if (error || !data) {
      toast.error('failed to start workout.');
      return;
    }
    router.push(`/workout/active?id=${data.id}`);
  }

  async function startFromDefault(template: DefaultTemplate) {
    if (!user) return;
    const { data, error } = await supabase
      .from('workouts')
      .insert({
        user_id: user.id,
        date: format(workoutDate, 'yyyy-MM-dd'),
        name: template.name,
      })
      .select()
      .single();

    if (error || !data) {
      toast.error('failed to start workout.');
      return;
    }
    const exercises = encodeURIComponent(JSON.stringify(template.exercises));
    router.push(`/workout/active?id=${data.id}&template=${exercises}`);
  }

  async function startFromTemplate(template: WorkoutTemplate) {
    if (!user) return;
    const { data, error } = await supabase
      .from('workouts')
      .insert({
        user_id: user.id,
        date: format(workoutDate, 'yyyy-MM-dd'),
        name: template.name,
      })
      .select()
      .single();

    if (error || !data) {
      toast.error('failed to start workout.');
      return;
    }
    const exercises = encodeURIComponent(JSON.stringify(template.exercises));
    router.push(`/workout/active?id=${data.id}&template=${exercises}`);
  }

  async function toggleWorkoutDetails(workoutId: string) {
    if (expandedWorkout === workoutId) {
      setExpandedWorkout(null);
      return;
    }
    setExpandedWorkout(workoutId);

    if (!workoutSets[workoutId]) {
      const { data } = await supabase
        .from('workout_sets')
        .select('*')
        .eq('workout_id', workoutId)
        .order('exercise_name')
        .order('set_number');
      if (data) {
        setWorkoutSets(prev => ({ ...prev, [workoutId]: data }));
      }
    }
  }

  async function deleteWorkout(workoutId: string) {
    setDeleting(workoutId);
    // Delete sets first, then workout
    await supabase.from('workout_sets').delete().eq('workout_id', workoutId);
    const { error } = await supabase.from('workouts').delete().eq('id', workoutId);
    if (error) {
      toast.error(`error: ${error.message}`);
    } else {
      toast.success('workout deleted.');
      refresh();
    }
    setDeleting(null);
  }

  async function copyDefaultToOwn(template: DefaultTemplate) {
    if (!user) return;
    const { error } = await supabase.from('workout_templates').insert({
      user_id: user.id,
      name: template.name,
      exercises: template.exercises,
    });
    if (error) {
      toast.error(`error: ${error.message}`);
    } else {
      toast.success('template copied to your templates.');
      const { data } = await supabase
        .from('workout_templates')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (data) setTemplates(data);
    }
  }

  // Group sets by exercise for display
  function groupSetsByExercise(sets: WorkoutSet[]) {
    const groups: Record<string, WorkoutSet[]> = {};
    for (const s of sets) {
      if (!groups[s.exercise_name]) groups[s.exercise_name] = [];
      groups[s.exercise_name].push(s);
    }
    return groups;
  }

  return (
    <div className="mx-auto max-w-md p-4 space-y-4">
      <h1 className="text-2xl font-bold">workout</h1>

      <Button onClick={() => { setWorkoutDate(new Date()); setShowStartDialog(true); }} className="w-full h-14 text-lg">
        <Plus className="mr-2 h-5 w-5" />
        start workout
      </Button>

      <Dialog open={showStartDialog} onOpenChange={setShowStartDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>start workout</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left text-sm">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(workoutDate, 'EEEE, MMM d, yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={workoutDate}
                  onSelect={(date) => date && setWorkoutDate(date)}
                  disabled={(date) => date > new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <Button
              variant="outline"
              className="w-full h-12 justify-start text-left"
              onClick={() => { setShowStartDialog(false); startNewWorkout(); }}
            >
              <Zap className="mr-3 h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">empty workout</p>
                <p className="text-xs text-muted-foreground">add exercises individually</p>
              </div>
            </Button>
            {templates.length > 0 && (
              <>
                <div className="text-xs text-muted-foreground uppercase tracking-wider pt-2 pb-1">your templates</div>
                {templates.map((t) => (
                  <Button
                    key={t.id}
                    variant="outline"
                    className="w-full h-12 justify-start text-left"
                    onClick={() => { setShowStartDialog(false); startFromTemplate(t); }}
                  >
                    <Play className="mr-3 h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.exercises.length} exercises</p>
                    </div>
                  </Button>
                ))}
              </>
            )}
            <div className="text-xs text-muted-foreground uppercase tracking-wider pt-2 pb-1">tr&aelig;ck templates</div>
            {DEFAULT_TEMPLATES.map((t) => (
              <Button
                key={t.id}
                variant="outline"
                className="w-full h-12 justify-start text-left"
                onClick={() => { setShowStartDialog(false); startFromDefault(t); }}
              >
                <Play className="mr-3 h-5 w-5 text-[#2626FF]" />
                <div>
                  <p className="font-medium">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.exercises.length} exercises</p>
                </div>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="history">
        <TabsList className="w-full">
          <TabsTrigger value="history" className="flex-1">history</TabsTrigger>
          <TabsTrigger value="templates" className="flex-1">templates</TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="space-y-2 mt-4">
          {loading ? (
            <p className="text-center text-muted-foreground py-8">loading...</p>
          ) : workouts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              no workouts recorded yet.
            </p>
          ) : (
            workouts.map((w) => {
              const isExpanded = expandedWorkout === w.id;
              const sets = workoutSets[w.id] || [];
              const exerciseGroups = groupSetsByExercise(sets);

              return (
                <Card key={w.id}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <button
                        className="flex-1 text-left"
                        onClick={() => toggleWorkoutDetails(w.id)}
                      >
                        <p className="font-medium">{w.name || 'Workout'}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(w.date + 'T12:00:00'), 'EEEE, MMM d, yyyy')}
                        </p>
                      </button>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => toggleWorkoutDetails(w.id)}
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-primary"
                          onClick={() => router.push(`/workout/edit?id=${w.id}`)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteWorkout(w.id)}
                          disabled={deleting === w.id}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-border space-y-3">
                        {sets.length === 0 ? (
                          <p className="text-xs text-muted-foreground">no sets recorded.</p>
                        ) : (
                          Object.entries(exerciseGroups).map(([exerciseName, exSets]) => (
                            <div key={exerciseName}>
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-sm font-medium">{exerciseName}</p>
                                {exSets[0]?.muscle_group && (
                                  <Badge variant="secondary" className="text-[10px]">
                                    {MUSCLE_GROUP_LABELS[exSets[0].muscle_group] || exSets[0].muscle_group}
                                  </Badge>
                                )}
                              </div>
                              <div className="space-y-0.5">
                                {exSets.map((s) => (
                                  <div key={s.id} className="flex items-center gap-3 text-xs text-muted-foreground">
                                    <span className="w-8">Set {s.set_number}</span>
                                    <span>{s.weight_kg ?? '–'} kg</span>
                                    <span>× {s.reps ?? '–'}</span>
                                    {s.rpe && <span className="text-[10px]">RPE {s.rpe}</span>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="templates" className="space-y-2 mt-4">
          {/* Own templates */}
          <div className="text-xs text-muted-foreground pt-2 pb-1">your templates</div>
          <Button variant="outline" className="w-full" asChild>
            <Link href="/workout/templates">
              <Plus className="mr-2 h-4 w-4" />
              create new template
            </Link>
          </Button>
          {templates.map((t) => (
            <Card key={t.id} className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => startFromTemplate(t)}>
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <p className="font-medium">{t.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.exercises.length} exercises
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                    onClick={(e) => { e.stopPropagation(); router.push(`/workout/templates?edit=${t.id}`); }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Play className="h-4 w-4 text-primary" />
                </div>
              </CardContent>
            </Card>
          ))}
          {templates.length === 0 && (
            <p className="text-center text-muted-foreground py-4 text-sm">
              no own templates yet.
            </p>
          )}

          {/* TRÆCK standard templates */}
          <div className="text-xs text-muted-foreground pt-2 pb-1">TR&AElig;CK templates</div>
          {DEFAULT_TEMPLATES.map((t) => (
            <Card key={t.id} className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => startFromDefault(t)}>
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <p className="font-medium">{t.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.exercises.length} exercises
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                    onClick={(e) => { e.stopPropagation(); copyDefaultToOwn(t); }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Play className="h-4 w-4 text-[#2626FF]" />
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
