'use client';

import { cn } from '@/lib/utils';

interface MacroRingsProps {
  calories: number;
  calorieGoal: number;
  protein: number;
  proteinGoal: number;
  carbs: number;
  carbsGoal: number;
  fat: number;
  fatGoal: number;
  size?: 'sm' | 'lg';
}

export function MacroRings({
  calories,
  calorieGoal,
  protein,
  proteinGoal,
  carbs,
  carbsGoal,
  fat,
  fatGoal,
  size = 'lg',
}: MacroRingsProps) {
  const calPercent = Math.min((calories / calorieGoal) * 100, 100);
  const ringSize = size === 'lg' ? 140 : 90;
  const strokeWidth = size === 'lg' ? 10 : 7;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (calPercent / 100) * circumference;
  const remaining = Math.max(calorieGoal - calories, 0);

  return (
    <div className="flex items-center gap-6">
      {/* Calorie Ring */}
      <div className="relative flex items-center justify-center" style={{ width: ringSize, height: ringSize }}>
        <svg width={ringSize} height={ringSize} className="-rotate-90">
          <defs>
            <linearGradient id="calorieGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#4833FF" />
              <stop offset="30%" stopColor="#8062FA" />
              <stop offset="100%" stopColor="#8062FA" />
            </linearGradient>
          </defs>
          <circle
            cx={ringSize / 2}
            cy={ringSize / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-muted/40"
          />
          <circle
            cx={ringSize / 2}
            cy={ringSize / 2}
            r={radius}
            fill="none"
            stroke={calories > calorieGoal ? 'currentColor' : 'url(#calorieGradient)'}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className={cn(
              'transition-all duration-500',
              calories > calorieGoal && 'text-destructive'
            )}
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className={cn('font-bold font-mono', size === 'lg' ? 'text-2xl' : 'text-lg')}>
            {Math.round(remaining)}
          </span>
          <span className={cn('text-muted-foreground', size === 'lg' ? 'text-xs' : 'text-[10px]')}>
            left
          </span>
        </div>
      </div>

      {/* Macro Bars */}
      <div className="flex-1 space-y-3">
        <MacroBar label="Protein" value={protein} goal={proteinGoal} gradient="linear-gradient(to right, #0096FF, #0096FF)" unit="g" />
        <MacroBar label="Carbs" value={carbs} goal={carbsGoal} gradient="linear-gradient(to right, #0096FF 0%, #004AC2 30%, #004AC2 100%)" unit="g" />
        <MacroBar label="Fat" value={fat} goal={fatGoal} gradient="linear-gradient(to right, #2DCAEF 0%, #0096FF 30%, #0096FF 100%)" unit="g" />
      </div>
    </div>
  );
}

function MacroBar({ label, value, goal, gradient, unit }: { label: string; value: number; goal: number; gradient: string; unit: string }) {
  const percent = Math.min((value / goal) * 100, 100);
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span>
          <span className="font-medium font-mono">{Math.round(value)}</span>
          <span className="text-muted-foreground">/{goal}{unit}</span>
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${percent}%`, backgroundImage: gradient }}
        />
      </div>
    </div>
  );
}
