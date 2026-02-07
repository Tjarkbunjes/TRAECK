'use client';

import { useMemo } from 'react';
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import type { WorkoutSet } from '@/lib/types';

interface MuscleRadarChartProps {
  sets: WorkoutSet[];
  mode: 'weight' | 'reps';
}

const MUSCLE_GROUPS = [
  { key: 'chest', label: 'Chest' },
  { key: 'back', label: 'Back' },
  { key: 'shoulders', label: 'Shoulders' },
  { key: 'legs', label: 'Legs' },
  { key: 'arms', label: 'Arms' },
  { key: 'core', label: 'Core' },
];

export function MuscleRadarChart({ sets, mode }: MuscleRadarChartProps) {
  const radarData = useMemo(() => {
    const totals = new Map<string, number>();
    for (const group of MUSCLE_GROUPS) {
      totals.set(group.key, 0);
    }

    for (const set of sets) {
      const mg = set.muscle_group?.toLowerCase();
      if (!mg || !totals.has(mg)) continue;

      if (mode === 'weight') {
        totals.set(mg, Math.max(totals.get(mg)!, set.weight_kg ?? 0));
      } else {
        totals.set(mg, totals.get(mg)! + (set.reps ?? 0));
      }
    }

    return MUSCLE_GROUPS.map((g) => ({
      muscle: g.label,
      value: Math.round(totals.get(g.key) ?? 0),
    }));
  }, [sets, mode]);

  const hasData = radarData.some((d) => d.value > 0);

  if (!hasData) {
    return (
      <div className="flex h-[300px] items-center justify-center text-muted-foreground text-sm">
        no strength data for this period.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
        <PolarGrid stroke="rgba(255,255,255,0.1)" />
        <PolarAngleAxis
          dataKey="muscle"
          tick={{ fontSize: 11, fill: '#d4d4d4' }}
        />
        <PolarRadiusAxis
          tick={{ fontSize: 10, fill: '#666' }}
          axisLine={false}
          tickCount={4}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#0F0F0F',
            border: '1px solid #292929',
            borderRadius: '8px',
            fontSize: '12px',
            color: '#fff',
          }}
          formatter={(value: number | undefined) => [
            mode === 'weight' ? `${(value ?? 0).toLocaleString()} kg` : `${value ?? 0} reps`,
            mode === 'weight' ? 'weight' : 'reps',
          ]}
        />
        <Radar
          dataKey="value"
          stroke="#2DCAEF"
          fill="#2DCAEF"
          fillOpacity={0.25}
          strokeWidth={2}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
