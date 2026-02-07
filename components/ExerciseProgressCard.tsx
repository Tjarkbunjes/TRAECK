'use client';

import {
  LineChart,
  Line,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface ExerciseProgressCardProps {
  name: string;
  maxWeight: number;
  change: number;
  sparklineData: number[];
}

export function ExerciseProgressCard({ name, maxWeight, change, sparklineData }: ExerciseProgressCardProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[#292929] bg-card p-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-lg font-bold font-mono">{maxWeight}kg</span>
          {change !== 0 ? (
            <span className={`flex items-center gap-0.5 text-xs font-mono ${change > 0 ? 'text-green-500' : 'text-rose-500'}`}>
              {change > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {change > 0 ? '+' : ''}{change}kg
            </span>
          ) : (
            <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
              <Minus className="h-3 w-3" />
              0kg
            </span>
          )}
        </div>
      </div>
      {sparklineData.length > 1 && (
        <div className="w-[80px] h-[30px] flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparklineData.map((v, i) => ({ i, v }))}>
              <Line
                type="monotone"
                dataKey="v"
                stroke={change >= 0 ? '#2DCAEF' : '#FF4467'}
                strokeWidth={1.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
