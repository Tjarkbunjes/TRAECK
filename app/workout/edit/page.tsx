'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/hooks';
import { exercises as exerciseDB, searchExercises, muscleGroups } from '@/lib/exercises';
import { MUSCLE_GROUP_LABELS } from '@/lib/types';
import type { WorkoutSet } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Save, ArrowLeft, Trash2, Search } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

interface EditSet {
  id?: string;
  set_number: number;
  weight_kg: number | null;
  reps: number | null;
  isNew?: boolean;
}

interface EditExerciseBlock {
  exercise_name: string;
  muscle_group: string;
  sets: EditSet[];
}

export default function EditWorkoutPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center text-muted-foreground">loading...</div>}>
      <EditWorkoutPageInner />
    </Suspense>
  );
}

function EditWorkoutPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const workoutId = searchParams.get('id');
  const { user } = useAuth();

  const [workoutName, setWorkoutName] = useState('');
  const [exerciseBlocks, setExerciseBlocks] = useState<EditExerciseBlock[]>([]);
  const [deletedSetIds, setDeletedSetIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showExerciseDialog, setShowExerciseDialog] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  useEffect(() => {
    if (!workoutId || !user) return;
    loadWorkout();
  }, [workoutId, user]);

  async function loadWorkout() {
    if (!workoutId) return;

    const [workoutRes, setsRes] = await Promise.all([
      supabase.from('workouts').select('*').eq('id', workoutId).single(),
      supabase.from('workout_sets').select('*').eq('workout_id', workoutId).order('exercise_name').order('set_number'),
    ]);

    if (workoutRes.data) {
      setWorkoutName(workoutRes.data.name || '');
    }

    if (setsRes.data) {
      const groups: Record<string, EditExerciseBlock> = {};
      for (const s of setsRes.data) {
        if (!groups[s.exercise_name]) {
          groups[s.exercise_name] = {
            exercise_name: s.exercise_name,
            muscle_group: s.muscle_group || '',
            sets: [],
          };
        }
        groups[s.exercise_name].sets.push({
          id: s.id,
          set_number: s.set_number,
          weight_kg: s.weight_kg,
          reps: s.reps,
        });
      }
      setExerciseBlocks(Object.values(groups));
    }
    setLoading(false);
  }

  function updateSet(blockIdx: number, setIdx: number, updates: Partial<EditSet>) {
    setExerciseBlocks(prev => {
      const updated = [...prev];
      const block = { ...updated[blockIdx] };
      block.sets = [...block.sets];
      block.sets[setIdx] = { ...block.sets[setIdx], ...updates };
      updated[blockIdx] = block;
      return updated;
    });
  }

  function deleteSet(blockIdx: number, setIdx: number) {
    setExerciseBlocks(prev => {
      const updated = [...prev];
      const block = { ...updated[blockIdx] };
      const removedSet = block.sets[setIdx];
      if (removedSet.id) {
        setDeletedSetIds(ids => [...ids, removedSet.id!]);
      }
      block.sets = block.sets.filter((_, i) => i !== setIdx).map((s, i) => ({ ...s, set_number: i + 1 }));
      if (block.sets.length === 0) {
        return updated.filter((_, i) => i !== blockIdx);
      }
      updated[blockIdx] = block;
      return updated;
    });
  }

  function addSet(blockIdx: number) {
    setExerciseBlocks(prev => {
      const updated = [...prev];
      const block = { ...updated[blockIdx] };
      block.sets = [...block.sets, {
        set_number: block.sets.length + 1,
        weight_kg: null,
        reps: null,
        isNew: true,
      }];
      updated[blockIdx] = block;
      return updated;
    });
  }

  function addExercise(name: string, muscleGroup: string) {
    setExerciseBlocks(prev => [
      ...prev,
      {
        exercise_name: name,
        muscle_group: muscleGroup,
        sets: [{ set_number: 1, weight_kg: null, reps: null, isNew: true }],
      },
    ]);
    setShowExerciseDialog(false);
    setExerciseSearch('');
    setSelectedGroup(null);
  }

  async function handleSave() {
    if (!workoutId) return;
    setSaving(true);

    await supabase.from('workouts').update({ name: workoutName || null }).eq('id', workoutId);

    if (deletedSetIds.length > 0) {
      await supabase.from('workout_sets').delete().in('id', deletedSetIds);
    }

    for (const block of exerciseBlocks) {
      for (const set of block.sets) {
        if (set.id && !set.isNew) {
          await supabase.from('workout_sets').update({
            weight_kg: set.weight_kg,
            reps: set.reps,
            set_number: set.set_number,
          }).eq('id', set.id);
        } else if (set.isNew || !set.id) {
          await supabase.from('workout_sets').insert({
            workout_id: workoutId,
            exercise_name: block.exercise_name,
            muscle_group: block.muscle_group,
            set_number: set.set_number,
            weight_kg: set.weight_kg,
            reps: set.reps,
          });
        }
      }
    }

    toast.success('workout saved.');
    setSaving(false);
    router.push('/workout');
  }

  const filteredExercises = exerciseSearch
    ? searchExercises(exerciseSearch)
    : selectedGroup
    ? exerciseDB.filter(e => e.muscleGroup === selectedGroup)
    : exerciseDB;

  if (loading) {
    return <div className="flex h-screen items-center justify-center text-muted-foreground">loading...</div>;
  }

  return (
    <div className="mx-auto max-w-md p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/workout"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <Input
          value={workoutName}
          onChange={(e) => setWorkoutName(e.target.value)}
          placeholder="workout name..."
          className="h-9 border-0 bg-transparent text-lg font-bold p-0 focus-visible:ring-0"
        />
      </div>

      {/* Exercise Blocks */}
      {exerciseBlocks.map((block, blockIdx) => (
        <Card key={blockIdx}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <span>{block.exercise_name}</span>
              <Badge variant="secondary" className="text-[10px]">
                {MUSCLE_GROUP_LABELS[block.muscle_group] || block.muscle_group}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase mb-1">
              <span className="w-6 text-center">Set</span>
              <span className="w-20 text-center">kg</span>
              <span className="w-16 text-center">Reps</span>
              <span className="w-9" />
            </div>
            {block.sets.map((set, setIdx) => (
              <div key={setIdx} className="flex items-center gap-2 py-1">
                <span className="w-6 text-center text-xs text-muted-foreground font-medium font-mono">
                  {set.set_number}
                </span>
                <Input
                  type="number"
                  step="0.5"
                  placeholder="kg"
                  value={set.weight_kg ?? ''}
                  onChange={(e) => updateSet(blockIdx, setIdx, { weight_kg: e.target.value ? parseFloat(e.target.value) : null })}
                  className="h-9 w-20 text-center"
                />
                <Input
                  type="number"
                  placeholder="Reps"
                  value={set.reps ?? ''}
                  onChange={(e) => updateSet(blockIdx, setIdx, { reps: e.target.value ? parseInt(e.target.value) : null })}
                  className="h-9 w-16 text-center"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteSet(blockIdx, setIdx)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
            <Button variant="ghost" size="sm" className="w-full text-xs mt-1" onClick={() => addSet(blockIdx)}>
              <Plus className="mr-1 h-3 w-3" />
              add set
            </Button>
          </CardContent>
        </Card>
      ))}

      {/* Add Exercise */}
      <Dialog open={showExerciseDialog} onOpenChange={setShowExerciseDialog}>
        <DialogTrigger asChild>
          <Button variant="outline" className="w-full">
            <Plus className="mr-2 h-4 w-4" />
            add exercise
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Choose Exercise</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="search exercise..."
                value={exerciseSearch}
                onChange={(e) => { setExerciseSearch(e.target.value); setSelectedGroup(null); }}
                className="pl-9"
              />
            </div>
            {!exerciseSearch && (
              <div className="flex flex-wrap gap-1.5">
                {muscleGroups.map(g => (
                  <Badge
                    key={g}
                    variant={selectedGroup === g ? 'default' : 'secondary'}
                    className="cursor-pointer"
                    onClick={() => setSelectedGroup(selectedGroup === g ? null : g)}
                  >
                    {MUSCLE_GROUP_LABELS[g] || g}
                  </Badge>
                ))}
              </div>
            )}
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {filteredExercises.map((ex, i) => (
                <button
                  key={i}
                  onClick={() => addExercise(ex.name, ex.muscleGroup)}
                  className="w-full text-left p-2 rounded-md hover:bg-accent/50 transition-colors text-sm"
                >
                  <span className="font-medium">{ex.name}</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    {MUSCLE_GROUP_LABELS[ex.muscleGroup]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Save */}
      <Button onClick={handleSave} className="w-full h-12 text-lg" disabled={saving}>
        <Save className="mr-2 h-5 w-5" />
        {saving ? 'saving...' : 'save changes'}
      </Button>
    </div>
  );
}
