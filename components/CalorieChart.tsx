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
import type { DailyFoodAggregate } from '@/lib/types';

interface CalorieChartProps {
  data: DailyFoodAggregate[];
  calorieGoal: number;
}

export function CalorieChart({ data, calorieGoal }: CalorieChartProps) {
  const chartData = useMemo(() => {
    return data.map((d) => ({
      date: d.date,
      label: format(new Date(d.date + 'T12:00:00'), 'MMM d'),
      calories: Math.round(d.calories),
    }));
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-muted-foreground text-sm">
        no nutrition data for this period.
      </div>
    );
  }

  const { min, max } = useMemo(() => {
    const values = data.map((d) => d.calories);
    return {
      min: Math.floor(Math.min(...values, calorieGoal) * 0.85),
      max: Math.ceil(Math.max(...values, calorieGoal) * 1.1),
    };
  }, [data, calorieGoal]);

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
          domain={[min, max]}
          tick={{ fontSize: 11, fill: '#d4d4d4' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${v}`}
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
          itemStyle={{ color: '#fff' }}
          formatter={(value: number | undefined) => [`${value ?? 0} kcal`, 'calories']}
        />
        <ReferenceLine
          y={calorieGoal}
          stroke="#2626FF"
          strokeDasharray="6 4"
          strokeOpacity={0.7}
          label={{
            value: `goal: ${calorieGoal}`,
            position: 'right',
            style: { fontSize: 10, fill: '#2626FF' },
          }}
        />
        <Line
          type="monotone"
          dataKey="calories"
          stroke="#2DCAEF"
          strokeWidth={2}
          dot={{ r: 3, fill: '#2DCAEF', stroke: '#2DCAEF' }}
          activeDot={{ r: 5, fill: '#2DCAEF' }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
