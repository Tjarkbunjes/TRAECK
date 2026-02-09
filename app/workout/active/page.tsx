'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth, useLastSets } from '@/lib/hooks';
import { exercises as exerciseDB, searchExercises, muscleGroups } from '@/lib/exercises';
import { MUSCLE_GROUP_LABELS } from '@/lib/types';
import type { WorkoutExercise } from '@/lib/types';
import { WorkoutSetRow } from '@/components/WorkoutSetRow';
import { MuscleMap } from '@/components/MuscleMap';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Check, ArrowLeft, Search, GripVertical, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SetData {
  id?: string;
  set_number: number;
  weight_kg: number | null;
  reps: number | null;
  completed: boolean;
}

interface ExerciseBlock {
  db_id: string;
  exercise_name: string;
  muscle_group: string;
  sets: SetData[];
}

export default function ActiveWorkoutPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center text-muted-foreground">loading...</div>}>
      <ActiveWorkoutPageInner />
    </Suspense>
  );
}

function ActiveWorkoutPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const workoutId = searchParams.get('id');
  const { user } = useAuth();

  const [exerciseBlocks, setExerciseBlocks] = useState<ExerciseBlock[]>([]);
  const [workoutName, setWorkoutName] = useState('');
  const [loading, setLoading] = useState(true);
  const [showExerciseDialog, setShowExerciseDialog] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [swapBlockId, setSwapBlockId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Load workout data from DB
  useEffect(() => {
    if (!workoutId) return;
    async function loadWorkout() {
      const { data: workout } = await supabase
        .from('workouts')
        .select('name')
        .eq('id', workoutId)
        .single();
      if (workout?.name) setWorkoutName(workout.name);

      const { data: exercises } = await supabase
        .from('workout_exercises')
        .select('*')
        .eq('workout_id', workoutId)
        .order('sort_order');

      const { data: sets } = await supabase
        .from('workout_sets')
        .select('*')
        .eq('workout_id', workoutId)
        .order('set_number');

      const blocks: ExerciseBlock[] = (exercises || []).map((ex: WorkoutExercise) => {
        const exerciseSets = (sets || [])
          .filter((s: { exercise_name: string }) => s.exercise_name === ex.exercise_name)
          .map((s: { id: string; set_number: number; weight_kg: number | null; reps: number | null }) => ({
            id: s.id,
            set_number: s.set_number,
            weight_kg: s.weight_kg,
            reps: s.reps,
            completed: true,
          }));

        if (exerciseSets.length === 0) {
          return {
            db_id: ex.id,
            exercise_name: ex.exercise_name,
            muscle_group: ex.muscle_group || '',
            sets: Array.from({ length: 3 }, (_, i) => ({
              set_number: i + 1, weight_kg: null, reps: null, completed: false,
            })),
          };
        }

        return {
          db_id: ex.id,
          exercise_name: ex.exercise_name,
          muscle_group: ex.muscle_group || '',
          sets: exerciseSets,
        };
      });

      setExerciseBlocks(blocks);
      setLoading(false);
    }
    loadWorkout();
  }, [workoutId]);

  const saveSet = useCallback(async (block: ExerciseBlock, set: SetData) => {
    if (!workoutId || (set.weight_kg === null && set.reps === null)) return;

    if (set.id) {
      await supabase.from('workout_sets').update({
        weight_kg: set.weight_kg,
        reps: set.reps,
      }).eq('id', set.id);
    } else {
      const { data } = await supabase.from('workout_sets').insert({
        workout_id: workoutId,
        exercise_name: block.exercise_name,
        muscle_group: block.muscle_group,
        set_number: set.set_number,
        weight_kg: set.weight_kg,
        reps: set.reps,
      }).select('id').single();

      if (data) {
        setExerciseBlocks(prev => prev.map(b =>
          b.db_id === block.db_id
            ? { ...b, sets: b.sets.map(s => s.set_number === set.set_number && !s.id ? { ...s, id: data.id } : s) }
            : b
        ));
      }
    }
  }, [workoutId]);

  async function addExercise(name: string, muscleGroup: string) {
    if (!workoutId) return;

    if (swapBlockId) {
      const block = exerciseBlocks.find(b => b.db_id === swapBlockId);
      if (block) {
        await supabase.from('workout_exercises').update({ exercise_name: name, muscle_group: muscleGroup }).eq('id', swapBlockId);
        await supabase.from('workout_sets').delete().eq('workout_id', workoutId).eq('exercise_name', block.exercise_name);
        setExerciseBlocks(prev => prev.map(b =>
          b.db_id === swapBlockId
            ? { ...b, exercise_name: name, muscle_group: muscleGroup, sets: Array.from({ length: 3 }, (_, i) => ({ set_number: i + 1, weight_kg: null, reps: null, completed: false })) }
            : b
        ));
      }
      setSwapBlockId(null);
      setShowExerciseDialog(false);
      setExerciseSearch('');
      setSelectedGroup(null);
      return;
    }

    const sortOrder = exerciseBlocks.length;
    const { data } = await supabase.from('workout_exercises').insert({
      workout_id: workoutId, exercise_name: name, muscle_group: muscleGroup, sort_order: sortOrder,
    }).select('id').single();

    if (data) {
      setExerciseBlocks(prev => [...prev, {
        db_id: data.id, exercise_name: name, muscle_group: muscleGroup,
        sets: [{ set_number: 1, weight_kg: null, reps: null, completed: false }],
      }]);
    }
    setShowExerciseDialog(false);
    setExerciseSearch('');
    setSelectedGroup(null);
  }

  function addSet(blockId: string) {
    setExerciseBlocks(prev => prev.map(b =>
      b.db_id === blockId
        ? { ...b, sets: [...b.sets, { set_number: b.sets.length + 1, weight_kg: null, reps: null, completed: false }] }
        : b
    ));
  }

  function updateSet(blockId: string, setIndex: number, updates: Partial<SetData>) {
    setExerciseBlocks(prev => prev.map(b => {
      if (b.db_id !== blockId) return b;
      const newSets = [...b.sets];
      const newSet = { ...newSets[setIndex], ...updates };
      newSets[setIndex] = newSet;
      if (updates.completed && newSet.completed) {
        saveSet({ ...b, sets: newSets }, newSet);
      }
      return { ...b, sets: newSets };
    }));
  }

  async function deleteSet(blockId: string, setIndex: number) {
    const block = exerciseBlocks.find(b => b.db_id === blockId);
    if (!block) return;
    const set = block.sets[setIndex];
    if (set.id) await supabase.from('workout_sets').delete().eq('id', set.id);

    setExerciseBlocks(prev => {
      const updated = prev.map(b => {
        if (b.db_id !== blockId) return b;
        const newSets = b.sets.filter((_, i) => i !== setIndex).map((s, i) => ({ ...s, set_number: i + 1 }));
        return { ...b, sets: newSets };
      });
      return updated.filter(b => b.db_id !== blockId || b.sets.length > 0);
    });
  }

  async function removeExercise(blockId: string) {
    if (!workoutId) return;
    const block = exerciseBlocks.find(b => b.db_id === blockId);
    if (!block) return;
    await supabase.from('workout_exercises').delete().eq('id', blockId);
    await supabase.from('workout_sets').delete().eq('workout_id', workoutId).eq('exercise_name', block.exercise_name);
    setExerciseBlocks(prev => prev.filter(b => b.db_id !== blockId));
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = exerciseBlocks.findIndex(b => b.db_id === active.id);
    const newIndex = exerciseBlocks.findIndex(b => b.db_id === over.id);
    const reordered = arrayMove(exerciseBlocks, oldIndex, newIndex);
    setExerciseBlocks(reordered);
    for (let i = 0; i < reordered.length; i++) {
      await supabase.from('workout_exercises').update({ sort_order: i }).eq('id', reordered[i].db_id);
    }
  }

  async function finishWorkout() {
    if (!user || !workoutId) return;
    setFinishing(true);
    for (const block of exerciseBlocks) {
      for (const set of block.sets) {
        if (set.completed && !set.id && (set.weight_kg !== null || set.reps !== null)) {
          await saveSet(block, set);
        }
      }
    }
    await supabase.from('workouts').update({ name: workoutName || null, finished_at: new Date().toISOString() }).eq('id', workoutId);
    toast.success('workout complete.');
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/workout"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <Input
            value={workoutName}
            onChange={(e) => setWorkoutName(e.target.value)}
            onBlur={() => workoutId && supabase.from('workouts').update({ name: workoutName || null }).eq('id', workoutId)}
            placeholder="workout name..."
            className="h-8 border-0 bg-transparent text-lg font-bold p-0 focus-visible:ring-0"
          />
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={exerciseBlocks.map(b => b.db_id)} strategy={verticalListSortingStrategy}>
          {exerciseBlocks.map((block) => (
            <SortableExerciseBlock
              key={block.db_id}
              block={block}
              onAddSet={() => addSet(block.db_id)}
              onUpdateSet={(setIdx, updates) => updateSet(block.db_id, setIdx, updates)}
              onDeleteSet={(setIdx) => deleteSet(block.db_id, setIdx)}
              onSwap={() => { setSwapBlockId(block.db_id); setShowExerciseDialog(true); }}
              onRemove={() => removeExercise(block.db_id)}
            />
          ))}
        </SortableContext>
      </DndContext>

      <Dialog open={showExerciseDialog} onOpenChange={(open) => { setShowExerciseDialog(open); if (!open) setSwapBlockId(null); }}>
        <DialogTrigger asChild>
          <Button variant="outline" className="w-full">
            <Plus className="mr-2 h-4 w-4" />
            add exercise
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{swapBlockId ? 'swap exercise' : 'choose exercise'}</DialogTitle>
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
                  className="w-full text-left p-2 rounded-md hover:bg-accent/50 transition-colors text-sm flex items-center gap-3"
                >
                  <MuscleMap muscleGroup={ex.muscleGroup} size={36} className="shrink-0" />
                  <div>
                    <span className="font-medium">{ex.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">{MUSCLE_GROUP_LABELS[ex.muscleGroup]}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {exerciseBlocks.length > 0 && (
        <Button onClick={finishWorkout} className="w-full h-12 text-lg" disabled={finishing}>
          <Check className="mr-2 h-5 w-5" />
          {finishing ? 'saving...' : 'finish workout'}
        </Button>
      )}
    </div>
  );
}

function SortableExerciseBlock({
  block, onAddSet, onUpdateSet, onDeleteSet, onSwap, onRemove,
}: {
  block: ExerciseBlock;
  onAddSet: () => void;
  onUpdateSet: (setIdx: number, updates: Partial<SetData>) => void;
  onDeleteSet: (setIdx: number) => void;
  onSwap: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.db_id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const lastSets = useLastSets(block.exercise_name);

  return (
    <div ref={setNodeRef} style={style}>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <button {...attributes} {...listeners} className="touch-none cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-1 -ml-1">
              <GripVertical className="h-4 w-4" />
            </button>
            <CardTitle className="text-base flex-1 flex items-center justify-between">
              <span>{block.exercise_name}</span>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onSwap} title="swap exercise">
                  <RefreshCw className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={onRemove} title="remove exercise">
                  <Trash2 className="h-3 w-3" />
                </Button>
                <Badge variant="secondary" className="text-[10px] ml-1">
                  {MUSCLE_GROUP_LABELS[block.muscle_group] || block.muscle_group}
                </Badge>
              </div>
            </CardTitle>
          </div>
          {lastSets.length > 0 && (
            <p className="text-xs text-muted-foreground font-mono pl-7">
              last time: {lastSets.map(s => `${s.weight_kg ?? '–'}kg × ${s.reps ?? '–'}`).join(', ')}
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-1">
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase mb-1">
            <span className="w-8 text-center shrink-0">Set</span>
            <span className="flex-1 text-center">kg</span>
            <span className="flex-1 text-center">Reps</span>
            <span className="w-9 shrink-0" />
            <span className="w-9 shrink-0" />
          </div>
          {block.sets.map((set, setIdx) => (
            <WorkoutSetRow
              key={set.id || `new-${setIdx}`}
              set={set}
              onChange={(updates) => onUpdateSet(setIdx, updates)}
              onDelete={() => onDeleteSet(setIdx)}
            />
          ))}
          <Button variant="ghost" size="sm" className="w-full text-xs mt-1" onClick={onAddSet}>
            <Plus className="mr-1 h-3 w-3" />
            add set
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
