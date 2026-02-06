'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash2, Pencil } from 'lucide-react';
import type { FoodEntry } from '@/lib/types';
import { MEAL_LABELS, type MealType } from '@/lib/types';

interface FoodEntryCardProps {
  entry: FoodEntry;
  onDelete?: (id: string) => void;
  onEdit?: (entry: FoodEntry) => void;
}

export function FoodEntryCard({ entry, onDelete, onEdit }: FoodEntryCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium truncate">{entry.food_name}</span>
            <Badge variant="secondary" className="text-[10px] shrink-0">
              {MEAL_LABELS[entry.meal_type as MealType]}
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{Math.round(entry.serving_grams)}g</span>
            <span className="font-medium text-foreground">{Math.round(entry.calories)} kcal</span>
            <span>P: {Math.round(entry.protein)}g</span>
            <span>K: {Math.round(entry.carbs)}g <span className="text-[10px] opacity-70">(dv. Z: {Math.round(entry.sugar)}g)</span></span>
            <span>F: {Math.round(entry.fat)}g <span className="text-[10px] opacity-70">(dv. GF: {Math.round(entry.saturated_fat)}g)</span></span>
          </div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {onEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-primary"
              onClick={() => onEdit(entry)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(entry.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
