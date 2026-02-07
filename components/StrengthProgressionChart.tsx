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

interface StrengthProgressionChartProps {
  workouts: Workout[];
  sets: WorkoutSet[];
  mode: 'volume' | 'reps';
}

export function StrengthProgressionChart({ workouts, sets, mode }: StrengthProgressionChartProps) {
  const chartData = useMemo(() => {
    const setsMap = new Map<string, WorkoutSet[]>();
    for (const set of sets) {
      const existing = setsMap.get(set.workout_id) || [];
      existing.push(set);
      setsMap.set(set.workout_id, existing);
    }

    return workouts
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((w) => {
        const wSets = setsMap.get(w.id) || [];
        let value: number;
        if (mode === 'volume') {
          value = wSets.reduce((sum, s) => sum + (s.weight_kg ?? 0) * (s.reps ?? 0), 0);
        } else {
          value = wSets.reduce((sum, s) => sum + (s.reps ?? 0), 0);
        }
        return {
          date: w.date,
          label: format(new Date(w.date + 'T12:00:00'), 'MMM d'),
          value: Math.round(value),
          name: w.name || 'workout',
        };
      });
  }, [workouts, sets, mode]);

  if (chartData.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-muted-foreground text-sm">
        no workout data for this period.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: '#d4d4d4' }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#d4d4d4' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => mode === 'volume' ? `${(v / 1000).toFixed(0)}t` : `${v}`}
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
          formatter={(value: number | undefined) => [
            mode === 'volume' ? `${(value ?? 0).toLocaleString()} kg` : `${value ?? 0} reps`,
            mode === 'volume' ? 'volume' : 'reps',
          ]}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke="#2DCAEF"
          strokeWidth={2}
          dot={{ r: 3, fill: '#2DCAEF', stroke: '#2DCAEF' }}
          activeDot={{ r: 5, fill: '#2DCAEF' }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
