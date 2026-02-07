'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth, useLastSets } from '@/lib/hooks';
import { exercises as exerciseDB, searchExercises, muscleGroups } from '@/lib/exercises';
import { MUSCLE_GROUP_LABELS } from '@/lib/types';
import { WorkoutSetRow } from '@/components/WorkoutSetRow';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Check, ArrowLeft, Search } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

interface SetData {
  set_number: number;
  weight_kg: number | null;
  reps: number | null;
  completed: boolean;
}

interface ExerciseBlock {
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
  const templateParam = searchParams.get('template');
  const { user } = useAuth();

  const [exerciseBlocks, setExerciseBlocks] = useState<ExerciseBlock[]>([]);
  const [workoutName, setWorkoutName] = useState('');
  const [showExerciseDialog, setShowExerciseDialog] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);

  // Load template exercises if provided
  useEffect(() => {
    if (templateParam) {
      try {
        const templateExercises = JSON.parse(decodeURIComponent(templateParam));
        const blocks: ExerciseBlock[] = templateExercises.map((ex: { exercise_name: string; muscle_group: string; default_sets: number }) => ({
          exercise_name: ex.exercise_name,
          muscle_group: ex.muscle_group,
          sets: Array.from({ length: ex.default_sets || 3 }, (_, i) => ({
            set_number: i + 1,
            weight_kg: null,
            reps: null,
            completed: false,
          })),
        }));
        setExerciseBlocks(blocks);
      } catch {}
    }
  }, [templateParam]);

  function addExercise(name: string, muscleGroup: string) {
    setExerciseBlocks(prev => [
      ...prev,
      {
        exercise_name: name,
        muscle_group: muscleGroup,
        sets: [{ set_number: 1, weight_kg: null, reps: null, completed: false }],
      },
    ]);
    setShowExerciseDialog(false);
    setExerciseSearch('');
    setSelectedGroup(null);
  }

  function addSet(blockIndex: number) {
    setExerciseBlocks(prev => {
      const updated = [...prev];
      const block = { ...updated[blockIndex] };
      block.sets = [...block.sets, {
        set_number: block.sets.length + 1,
        weight_kg: null,
        reps: null,
        completed: false,
      }];
      updated[blockIndex] = block;
      return updated;
    });
  }

  function updateSet(blockIndex: number, setIndex: number, updates: Partial<SetData>) {
    setExerciseBlocks(prev => {
      const updated = [...prev];
      const block = { ...updated[blockIndex] };
      block.sets = [...block.sets];
      block.sets[setIndex] = { ...block.sets[setIndex], ...updates };
      updated[blockIndex] = block;
      return updated;
    });
  }

  function deleteSet(blockIndex: number, setIndex: number) {
    setExerciseBlocks(prev => {
      const updated = [...prev];
      const block = { ...updated[blockIndex] };
      block.sets = block.sets.filter((_, i) => i !== setIndex).map((s, i) => ({ ...s, set_number: i + 1 }));
      if (block.sets.length === 0) {
        return updated.filter((_, i) => i !== blockIndex);
      }
      updated[blockIndex] = block;
      return updated;
    });
  }

  async function finishWorkout() {
    if (!user || !workoutId) return;
    setFinishing(true);

    const allSets = exerciseBlocks.flatMap(block =>
      block.sets
        .filter(s => s.completed && (s.weight_kg !== null || s.reps !== null))
        .map(s => ({
          workout_id: workoutId,
          exercise_name: block.exercise_name,
          muscle_group: block.muscle_group,
          set_number: s.set_number,
          weight_kg: s.weight_kg,
          reps: s.reps,
        }))
    );

    if (allSets.length > 0) {
      const { error } = await supabase.from('workout_sets').insert(allSets);
      if (error) {
        toast.error('failed to save sets.');
        setFinishing(false);
        return;
      }
    }

    await supabase
      .from('workouts')
      .update({
        name: workoutName || null,
      })
      .eq('id', workoutId);

    toast.success('workout complete.');
    router.push('/workout');
  }

  const filteredExercises = exerciseSearch
    ? searchExercises(exerciseSearch)
    : selectedGroup
    ? exerciseDB.filter(e => e.muscleGroup === selectedGroup)
    : exerciseDB;

  return (
    <div className="mx-auto max-w-md p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/workout"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div>
            <Input
              value={workoutName}
              onChange={(e) => setWorkoutName(e.target.value)}
              placeholder="workout name..."
              className="h-8 border-0 bg-transparent text-lg font-bold p-0 focus-visible:ring-0"
            />
          </div>
        </div>
      </div>

      {/* Exercise Blocks */}
      {exerciseBlocks.map((block, blockIdx) => (
        <ExerciseBlockComponent
          key={blockIdx}
          block={block}
          blockIndex={blockIdx}
          onAddSet={() => addSet(blockIdx)}
          onUpdateSet={(setIdx, updates) => updateSet(blockIdx, setIdx, updates)}
          onDeleteSet={(setIdx) => deleteSet(blockIdx, setIdx)}
        />
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
            <DialogTitle>choose exercise</DialogTitle>
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

      {/* Finish */}
      {exerciseBlocks.length > 0 && (
        <Button onClick={finishWorkout} className="w-full h-12 text-lg" disabled={finishing}>
          <Check className="mr-2 h-5 w-5" />
          {finishing ? 'saving...' : 'finish workout'}
        </Button>
      )}
    </div>
  );
}

// Sub-component for each exercise block
function ExerciseBlockComponent({
  block,
  blockIndex,
  onAddSet,
  onUpdateSet,
  onDeleteSet,
}: {
  block: ExerciseBlock;
  blockIndex: number;
  onAddSet: () => void;
  onUpdateSet: (setIdx: number, updates: Partial<SetData>) => void;
  onDeleteSet: (setIdx: number) => void;
}) {
  const lastSets = useLastSets(block.exercise_name);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <span>{block.exercise_name}</span>
          <Badge variant="secondary" className="text-[10px]">
            {MUSCLE_GROUP_LABELS[block.muscle_group] || block.muscle_group}
          </Badge>
        </CardTitle>
        {lastSets.length > 0 && (
          <p className="text-xs text-muted-foreground font-mono">
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
            key={setIdx}
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
  );
}
