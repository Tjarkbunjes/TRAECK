'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth, useWeightEntries, useProfile } from '@/lib/hooks';
import { WeightChart } from '@/components/WeightChart';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

type TimeRange = '7' | '30' | '90' | '365';

export default function WeightPage() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [range, setRange] = useState<TimeRange>('30');
  const { entries, loading, refresh } = useWeightEntries(parseInt(range));

  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!user || !weight) {
      toast.error('Bitte Gewicht eingeben');
      return;
    }
    setSaving(true);
    const today = format(new Date(), 'yyyy-MM-dd');

    const { error } = await supabase.from('weight_entries').upsert(
      {
        user_id: user.id,
        date: today,
        weight_kg: parseFloat(weight),
        body_fat_pct: bodyFat ? parseFloat(bodyFat) : null,
      },
      { onConflict: 'user_id,date' }
    );

    if (error) {
      console.error('Weight save error:', error);
      toast.error(`Fehler: ${error.message}`);
    } else {
      toast.success('Gewicht gespeichert');
      setWeight('');
      setBodyFat('');
      refresh();
    }
    setSaving(false);
  }

  const latest = entries.length > 0 ? entries[entries.length - 1] : null;
  const previous = entries.length > 1 ? entries[entries.length - 2] : null;
  const diff = latest && previous ? latest.weight_kg - previous.weight_kg : null;

  // 7-day average
  const last7 = entries.slice(-7);
  const avg7 = last7.length > 0
    ? Math.round((last7.reduce((s, e) => s + e.weight_kg, 0) / last7.length) * 10) / 10
    : null;

  return (
    <div className="mx-auto max-w-md p-4 space-y-4">
      <h1 className="text-2xl font-bold">Gewicht</h1>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-2">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{latest?.weight_kg || '–'}</p>
            <p className="text-xs text-muted-foreground">Aktuell (kg)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold flex items-center justify-center gap-1">
              {diff !== null ? (
                <>
                  {diff > 0 ? <TrendingUp className="h-4 w-4 text-rose-500" /> : diff < 0 ? <TrendingDown className="h-4 w-4 text-green-500" /> : <Minus className="h-4 w-4" />}
                  {Math.abs(diff).toFixed(1)}
                </>
              ) : '–'}
            </p>
            <p className="text-xs text-muted-foreground">Änderung (kg)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{avg7 || '–'}</p>
            <p className="text-xs text-muted-foreground">Ø 7 Tage</p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Verlauf</CardTitle>
            <Tabs value={range} onValueChange={(v) => setRange(v as TimeRange)}>
              <TabsList className="h-8">
                <TabsTrigger value="7" className="text-xs px-2 h-6">7T</TabsTrigger>
                <TabsTrigger value="30" className="text-xs px-2 h-6">30T</TabsTrigger>
                <TabsTrigger value="90" className="text-xs px-2 h-6">90T</TabsTrigger>
                <TabsTrigger value="365" className="text-xs px-2 h-6">1J</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground">Laden...</div>
          ) : (
            <WeightChart entries={entries} targetWeight={profile?.target_weight} />
          )}
        </CardContent>
      </Card>

      {/* Add Weight */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Gewicht eintragen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Gewicht (kg)</Label>
              <Input
                type="number"
                step="0.1"
                placeholder="z.B. 82.5"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Körperfett % (optional)</Label>
              <Input
                type="number"
                step="0.1"
                placeholder="z.B. 15.0"
                value={bodyFat}
                onChange={(e) => setBodyFat(e.target.value)}
              />
            </div>
          </div>
          <Button onClick={handleSave} className="w-full" disabled={saving}>
            <Plus className="mr-2 h-4 w-4" />
            {saving ? 'Speichern...' : 'Heute speichern'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
