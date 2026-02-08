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
import { Plus, Save, ArrowLeft, Trash2, Search, RefreshCw, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  verticalListSortingStrategy, useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface EditSet {
  id?: string;
  set_number: number;
  weight_kg: number | null;
  reps: number | null;
  isNew?: boolean;
}

interface EditExerciseBlock {
  block_id: string;
  exercise_name: string;
  muscle_group: string;
  original_exercise_name?: string;
  sets: EditSet[];
}

let nextBlockId = 0;
function genBlockId() { return `block-${nextBlockId++}`; }

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
  const [deletedExerciseNames, setDeletedExerciseNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showExerciseDialog, setShowExerciseDialog] = useState(false);
  const [swapBlockIdx, setSwapBlockIdx] = useState<number | null>(null);
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = exerciseBlocks.findIndex(b => b.block_id === active.id);
    const newIndex = exerciseBlocks.findIndex(b => b.block_id === over.id);
    if (oldIndex !== -1 && newIndex !== -1) {
      setExerciseBlocks(prev => arrayMove(prev, oldIndex, newIndex));
    }
  }

  useEffect(() => {
    if (!workoutId || !user) return;
    loadWorkout();
  }, [workoutId, user]);

  async function loadWorkout() {
    if (!workoutId) return;

    const [workoutRes, exercisesRes, setsRes] = await Promise.all([
      supabase.from('workouts').select('*').eq('id', workoutId).single(),
      supabase.from('workout_exercises').select('*').eq('workout_id', workoutId).order('sort_order'),
      supabase.from('workout_sets').select('*').eq('workout_id', workoutId).order('exercise_name').order('set_number'),
    ]);

    if (workoutRes.data) {
      setWorkoutName(workoutRes.data.name || '');
    }

    // Group sets by exercise name
    const setsByExercise: Record<string, EditSet[]> = {};
    for (const s of (setsRes.data || [])) {
      if (!setsByExercise[s.exercise_name]) setsByExercise[s.exercise_name] = [];
      setsByExercise[s.exercise_name].push({
        id: s.id,
        set_number: s.set_number,
        weight_kg: s.weight_kg,
        reps: s.reps,
      });
    }

    if (exercisesRes.data && exercisesRes.data.length > 0) {
      // Build blocks from workout_exercises (preserves empty exercises)
      const blocks: EditExerciseBlock[] = exercisesRes.data.map((ex: { exercise_name: string; muscle_group: string | null }) => ({
        block_id: genBlockId(),
        exercise_name: ex.exercise_name,
        muscle_group: ex.muscle_group || '',
        original_exercise_name: ex.exercise_name,
        sets: setsByExercise[ex.exercise_name] || Array.from({ length: 3 }, (_, i) => ({
          set_number: i + 1, weight_kg: null, reps: null, isNew: true,
        })),
      }));
      setExerciseBlocks(blocks);
    } else {
      // Fallback: build from sets only (workouts without workout_exercises records)
      const seen = new Set<string>();
      const blocks: EditExerciseBlock[] = [];
      for (const s of (setsRes.data || [])) {
        if (!seen.has(s.exercise_name)) {
          seen.add(s.exercise_name);
          blocks.push({
            block_id: genBlockId(),
            exercise_name: s.exercise_name,
            muscle_group: s.muscle_group || '',
            original_exercise_name: s.exercise_name,
            sets: setsByExercise[s.exercise_name] || [],
          });
        }
      }
      setExerciseBlocks(blocks);
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

  function deleteExerciseBlock(blockIdx: number) {
    setExerciseBlocks(prev => {
      const block = prev[blockIdx];
      // Track set IDs to delete from DB
      for (const s of block.sets) {
        if (s.id) {
          setDeletedSetIds(ids => [...ids, s.id!]);
        }
      }
      // Track original exercise name for workout_exercises cleanup
      if (block.original_exercise_name) {
        setDeletedExerciseNames(names => [...names, block.original_exercise_name!]);
      }
      return prev.filter((_, i) => i !== blockIdx);
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
    if (swapBlockIdx !== null) {
      // Swap exercise
      setExerciseBlocks(prev => {
        const updated = [...prev];
        const block = { ...updated[swapBlockIdx] };
        block.exercise_name = name;
        block.muscle_group = muscleGroup;
        updated[swapBlockIdx] = block;
        return updated;
      });
      setSwapBlockIdx(null);
    } else {
      // Add new exercise
      setExerciseBlocks(prev => [
        ...prev,
        {
          block_id: genBlockId(),
          exercise_name: name,
          muscle_group: muscleGroup,
          sets: Array.from({ length: 3 }, (_, i) => ({ set_number: i + 1, weight_kg: null, reps: null, isNew: true })),
        },
      ]);
    }
    setShowExerciseDialog(false);
    setExerciseSearch('');
    setSelectedGroup(null);
  }

  async function handleSave() {
    if (!workoutId) return;
    setSaving(true);

    try {
      await supabase.from('workouts').update({ name: workoutName || null }).eq('id', workoutId);

      // Delete removed sets
      if (deletedSetIds.length > 0) {
        await supabase.from('workout_sets').delete().in('id', deletedSetIds);
      }

      // Delete removed exercises from workout_exercises
      for (const exName of deletedExerciseNames) {
        await supabase.from('workout_exercises')
          .delete()
          .eq('workout_id', workoutId)
          .eq('exercise_name', exName);
      }

      // First: sync workout_exercises (swaps, new exercises, sort order)
      for (let i = 0; i < exerciseBlocks.length; i++) {
        const block = exerciseBlocks[i];

        if (block.original_exercise_name && block.original_exercise_name !== block.exercise_name) {
          // Exercise was swapped — update the existing workout_exercises record
          const { error } = await supabase.from('workout_exercises')
            .update({ exercise_name: block.exercise_name, muscle_group: block.muscle_group, sort_order: i })
            .eq('workout_id', workoutId)
            .eq('exercise_name', block.original_exercise_name);
          if (error) console.error('workout_exercises swap error:', error);
        } else if (!block.original_exercise_name) {
          // New exercise added in edit mode — create workout_exercises record
          const { error } = await supabase.from('workout_exercises').insert({
            workout_id: workoutId,
            exercise_name: block.exercise_name,
            muscle_group: block.muscle_group,
            sort_order: i,
          });
          if (error) console.error('workout_exercises insert error:', error);
        } else {
          // Unchanged exercise — update sort_order
          await supabase.from('workout_exercises')
            .update({ sort_order: i })
            .eq('workout_id', workoutId)
            .eq('exercise_name', block.exercise_name);
        }
      }

      // Second: sync workout_sets
      for (const block of exerciseBlocks) {
        for (const set of block.sets) {
          const hasData = set.weight_kg !== null || set.reps !== null;

          if (set.id && !set.isNew) {
            // Update existing set (including possible exercise name change)
            const { error } = await supabase.from('workout_sets').update({
              exercise_name: block.exercise_name,
              muscle_group: block.muscle_group,
              weight_kg: set.weight_kg,
              reps: set.reps,
              set_number: set.set_number,
            }).eq('id', set.id);
            if (error) console.error('workout_sets update error:', error);
          } else if ((set.isNew || !set.id) && hasData) {
            // Only insert new sets that have actual data
            const { error } = await supabase.from('workout_sets').insert({
              workout_id: workoutId,
              exercise_name: block.exercise_name,
              muscle_group: block.muscle_group,
              set_number: set.set_number,
              weight_kg: set.weight_kg,
              reps: set.reps,
            });
            if (error) console.error('workout_sets insert error:', error);
          }
        }
      }

      toast.success('workout saved.');
      router.push('/workout');
    } catch (err) {
      console.error('save error:', err);
      toast.error('failed to save workout.');
    } finally {
      setSaving(false);
    }
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
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={exerciseBlocks.map(b => b.block_id)} strategy={verticalListSortingStrategy}>
          {exerciseBlocks.map((block, blockIdx) => (
            <SortableEditBlock
              key={block.block_id}
              block={block}
              onSwap={() => { setSwapBlockIdx(blockIdx); setShowExerciseDialog(true); }}
              onRemove={() => deleteExerciseBlock(blockIdx)}
              onAddSet={() => addSet(blockIdx)}
              onUpdateSet={(setIdx, updates) => updateSet(blockIdx, setIdx, updates)}
              onDeleteSet={(setIdx) => deleteSet(blockIdx, setIdx)}
            />
          ))}
        </SortableContext>
      </DndContext>

      {/* Add Exercise */}
      <Dialog open={showExerciseDialog} onOpenChange={(open) => { setShowExerciseDialog(open); if (!open) setSwapBlockIdx(null); }}>
        <DialogTrigger asChild>
          <Button variant="outline" className="w-full">
            <Plus className="mr-2 h-4 w-4" />
            add exercise
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{swapBlockIdx !== null ? 'swap exercise' : 'choose exercise'}</DialogTitle>
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

function SortableEditBlock({
  block, onSwap, onRemove, onAddSet, onUpdateSet, onDeleteSet,
}: {
  block: EditExerciseBlock;
  onSwap: () => void;
  onRemove: () => void;
  onAddSet: () => void;
  onUpdateSet: (setIdx: number, updates: Partial<EditSet>) => void;
  onDeleteSet: (setIdx: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.block_id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

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
        </CardHeader>
        <CardContent className="space-y-1">
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase mb-1">
            <span className="w-8 text-center shrink-0">Set</span>
            <span className="flex-1 text-center">kg</span>
            <span className="flex-1 text-center">Reps</span>
            <span className="w-9 shrink-0" />
          </div>
          {block.sets.map((set, setIdx) => (
            <div key={setIdx} className="flex items-center gap-2 py-1.5">
              <span className="w-8 text-center text-xs text-muted-foreground font-medium shrink-0">
                {set.set_number}
              </span>
              <Input
                type="number"
                step="0.5"
                placeholder="kg"
                value={set.weight_kg ?? ''}
                onChange={(e) => onUpdateSet(setIdx, { weight_kg: e.target.value ? parseFloat(e.target.value) : null })}
                className="h-9 flex-1 text-center"
              />
              <Input
                type="number"
                placeholder="Reps"
                value={set.reps ?? ''}
                onChange={(e) => onUpdateSet(setIdx, { reps: e.target.value ? parseInt(e.target.value) : null })}
                className="h-9 flex-1 text-center"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => onDeleteSet(setIdx)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
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
