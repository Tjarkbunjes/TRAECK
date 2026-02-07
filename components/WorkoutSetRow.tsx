'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Trash2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SetData {
  set_number: number;
  weight_kg: number | null;
  reps: number | null;
  completed: boolean;
}

interface WorkoutSetRowProps {
  set: SetData;
  lastSet?: { weight_kg: number | null; reps: number | null };
  onChange: (updates: Partial<SetData>) => void;
  onDelete: () => void;
}

export function WorkoutSetRow({ set, lastSet, onChange, onDelete }: WorkoutSetRowProps) {
  return (
    <div className={cn(
      'flex items-center gap-2 py-1.5',
      set.completed && 'opacity-60'
    )}>
      <span className="w-8 text-center text-xs text-muted-foreground font-medium shrink-0">
        {set.set_number}
      </span>

      <Input
        type="number"
        step="0.5"
        placeholder="kg"
        value={set.weight_kg ?? ''}
        onChange={(e) => onChange({ weight_kg: e.target.value ? parseFloat(e.target.value) : null })}
        className="h-9 flex-1 text-center"
      />
      <Input
        type="number"
        placeholder="Reps"
        value={set.reps ?? ''}
        onChange={(e) => onChange({ reps: e.target.value ? parseInt(e.target.value) : null })}
        className="h-9 flex-1 text-center"
      />

      <Button
        variant={set.completed ? 'default' : 'outline'}
        size="icon"
        className="h-9 w-9 shrink-0"
        onClick={() => onChange({ completed: !set.completed })}
      >
        <Check className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={onDelete}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
}
