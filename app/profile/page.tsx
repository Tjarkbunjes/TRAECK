'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth, useProfile } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useRouter } from 'next/navigation';
import { LogOut, Save } from 'lucide-react';
import { toast } from 'sonner';

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const router = useRouter();

  const [displayName, setDisplayName] = useState('');
  const [calorieGoal, setCalorieGoal] = useState(2000);
  const [proteinGoal, setProteinGoal] = useState(150);
  const [carbsGoal, setCarbsGoal] = useState(250);
  const [fatGoal, setFatGoal] = useState(70);
  const [targetWeight, setTargetWeight] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '');
      setCalorieGoal(profile.calorie_goal);
      setProteinGoal(profile.protein_goal);
      setCarbsGoal(profile.carbs_goal);
      setFatGoal(profile.fat_goal);
      setTargetWeight(profile.target_weight?.toString() || '');
    }
  }, [profile]);

  async function handleSave() {
    if (!user) return;
    setSaving(true);

    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        display_name: displayName || null,
        calorie_goal: calorieGoal,
        protein_goal: proteinGoal,
        carbs_goal: carbsGoal,
        fat_goal: fatGoal,
        target_weight: targetWeight ? parseFloat(targetWeight) : null,
      });

    if (error) {
      console.error('Profile save error:', error);
      toast.error(`Fehler: ${error.message}`);
    } else {
      toast.success('Einstellungen gespeichert');
    }
    setSaving(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/auth/login');
  }

  if (authLoading || profileLoading) {
    return <div className="flex h-screen items-center justify-center"><span className="text-muted-foreground">Laden...</span></div>;
  }

  return (
    <div className="mx-auto max-w-md p-4 space-y-4">
      <h1 className="text-2xl font-bold">Profil & Einstellungen</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Persönliche Daten</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>E-Mail</Label>
            <Input value={user?.email || ''} disabled />
          </div>
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Dein Name"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tagesziele</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Kalorien (kcal)</Label>
            <Input
              type="number"
              value={calorieGoal}
              onChange={(e) => setCalorieGoal(Number(e.target.value))}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Protein (g)</Label>
              <Input
                type="number"
                value={proteinGoal}
                onChange={(e) => setProteinGoal(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Carbs (g)</Label>
              <Input
                type="number"
                value={carbsGoal}
                onChange={(e) => setCarbsGoal(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Fett (g)</Label>
              <Input
                type="number"
                value={fatGoal}
                onChange={(e) => setFatGoal(Number(e.target.value))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Gewichtsziel</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Zielgewicht (kg)</Label>
            <Input
              type="number"
              step="0.1"
              value={targetWeight}
              onChange={(e) => setTargetWeight(e.target.value)}
              placeholder="z.B. 80.0"
            />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} className="w-full" disabled={saving}>
        <Save className="mr-2 h-4 w-4" />
        {saving ? 'Speichern...' : 'Einstellungen speichern'}
      </Button>

      <Separator />

      <Button onClick={handleLogout} variant="outline" className="w-full text-destructive">
        <LogOut className="mr-2 h-4 w-4" />
        Abmelden
      </Button>
    </div>
  );
}
