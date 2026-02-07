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
  ReferenceLine,
} from 'recharts';
import { format } from 'date-fns';
import type { WeightEntry } from '@/lib/types';

interface WeightChartProps {
  entries: WeightEntry[];
  targetWeight?: number | null;
}

export function WeightChart({ entries, targetWeight }: WeightChartProps) {
  const chartData = useMemo(() => {
    return entries.map((entry, idx) => {
      const start = Math.max(0, idx - 6);
      const window = entries.slice(start, idx + 1);
      const avg = window.reduce((s, e) => s + e.weight_kg, 0) / window.length;

      return {
        date: entry.date,
        label: format(new Date(entry.date + 'T12:00:00'), 'MMM d'),
        weight: entry.weight_kg,
        average: Math.round(avg * 10) / 10,
      };
    });
  }, [entries]);

  if (entries.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-muted-foreground text-sm">
        no weight data yet.
      </div>
    );
  }

  const weights = entries.map((e) => e.weight_kg);
  const min = Math.floor(Math.min(...weights) - 1);
  const max = Math.ceil(Math.max(...weights) + 1);

  return (
    <div>
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 12, fill: '#d4d4d4' }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[min, max]}
          tick={{ fontSize: 12, fill: '#d4d4d4' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${v}kg`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#1a1a1a',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '8px',
            fontSize: '12px',
            color: '#fff',
          }}
          labelStyle={{ color: '#fff' }}
          itemStyle={{ color: '#fff' }}
          formatter={(value: number | undefined, name: string | undefined) => [
            `${value ?? 0} kg`,
            name === 'weight' ? 'Weight' : '7d Avg',
          ]}
        />
        {targetWeight && (
          <ReferenceLine
            y={targetWeight}
            stroke="#facc15"
            strokeDasharray="6 4"
            strokeOpacity={0.7}
            label={{
              value: `Goal: ${targetWeight}kg`,
              position: 'right',
              style: { fontSize: 10, fill: '#facc15' },
            }}
          />
        )}
        <Line
          type="monotone"
          dataKey="weight"
          stroke="rgba(255,255,255,0.4)"
          strokeWidth={1}
          dot={{ r: 4, fill: '#0096FF', stroke: '#0096FF' }}
          activeDot={{ r: 6, fill: '#0096FF' }}
          name="weight"
        />
        <Line
          type="monotone"
          dataKey="average"
          stroke="#0096FF"
          strokeWidth={2.5}
          dot={false}
          name="average"
        />
      </LineChart>
    </ResponsiveContainer>
    <div className="flex items-center justify-center gap-4 mt-2 text-xs">
      <div className="flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#0096FF]" />
        <span className="text-[#d4d4d4]">Weight / 7d Avg</span>
      </div>
      {targetWeight && (
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 bg-[#facc15]" style={{ borderTop: '2px dashed #facc15', background: 'none' }} />
          <span className="text-[#d4d4d4]">Goal ({targetWeight}kg)</span>
        </div>
      )}
    </div>
    </div>
  );
}
