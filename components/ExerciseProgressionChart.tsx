'use client';

import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';
import type { Workout, WorkoutSet } from '@/lib/types';

interface ExerciseProgressionChartProps {
  exerciseName: string;
  workouts: Workout[];
  sets: WorkoutSet[];
}

export function ExerciseProgressionChart({ exerciseName, workouts, sets }: ExerciseProgressionChartProps) {
  const chartData = useMemo(() => {
    const workoutDateMap = new Map<string, string>();
    for (const w of workouts) {
      workoutDateMap.set(w.id, w.date);
    }

    // Group sets for this exercise by workout date
    const perWorkout = new Map<string, { weight: number; reps: number }>();
    for (const s of sets) {
      if (s.exercise_name !== exerciseName) continue;
      const date = workoutDateMap.get(s.workout_id);
      if (!date) continue;
      const existing = perWorkout.get(date) || { weight: 0, reps: 0 };
      existing.weight = Math.max(existing.weight, s.weight_kg ?? 0);
      existing.reps += s.reps ?? 0;
      perWorkout.set(date, existing);
    }

    return Array.from(perWorkout.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, data]) => ({
        label: format(new Date(date + 'T12:00:00'), 'MMM d'),
        weight: data.weight,
        reps: data.reps,
      }));
  }, [exerciseName, workouts, sets]);

  if (chartData.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{exerciseName}</p>
      <ResponsiveContainer width="100%" height={150}>
        <LineChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: '#d4d4d4' }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            yAxisId="weight"
            tick={{ fontSize: 10, fill: '#d4d4d4' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v}kg`}
            width={35}
          />
          <YAxis
            yAxisId="reps"
            orientation="right"
            tick={{ fontSize: 10, fill: '#d4d4d4' }}
            tickLine={false}
            axisLine={false}
            width={30}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0F0F0F',
              border: '1px solid #292929',
              borderRadius: '8px',
              fontSize: '12px',
              color: '#fff',
            }}
            labelStyle={{ color: '#fff' }}
            formatter={(value: number | undefined, name: string | undefined) => [
              name === 'weight' ? `${value ?? 0} kg` : `${value ?? 0}`,
              name === 'weight' ? 'weight' : 'reps',
            ]}
          />
          <Line
            yAxisId="weight"
            type="monotone"
            dataKey="weight"
            stroke="#2DCAEF"
            strokeWidth={2}
            dot={{ r: 2.5, fill: '#2DCAEF', stroke: '#2DCAEF' }}
            activeDot={{ r: 4, fill: '#2DCAEF' }}
          />
          <Line
            yAxisId="reps"
            type="monotone"
            dataKey="reps"
            stroke="#2626FF"
            strokeWidth={1.5}
            strokeDasharray="4 2"
            dot={{ r: 2, fill: '#2626FF', stroke: '#2626FF' }}
            activeDot={{ r: 4, fill: '#2626FF' }}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex items-center justify-center gap-4 text-[10px]">
        <div className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-[#2DCAEF]" />
          <span className="text-[#d4d4d4]">weight</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-3 bg-[#2626FF]" style={{ borderTop: '2px dashed #2626FF', background: 'none' }} />
          <span className="text-[#d4d4d4]">reps</span>
        </div>
      </div>
    </div>
  );
}
