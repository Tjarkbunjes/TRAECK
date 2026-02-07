'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { searchFood } from '@/lib/food-api';
import { useAuth } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Search, Star, Clock, Save, ScanBarcode } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { MEAL_LABELS, type MealType, type FoodProduct } from '@/lib/types';
import Link from 'next/link';

export default function AddFoodPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center text-muted-foreground">loading...</div>}>
      <AddFoodPageInner />
    </Suspense>
  );
}

function AddFoodPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const date = searchParams.get('date') || format(new Date(), 'yyyy-MM-dd');
  const prefillParam = searchParams.get('prefill');
  const editId = searchParams.get('edit');
  const { user } = useAuth();

  const [mealType, setMealType] = useState<MealType>('lunch');
  const [foodName, setFoodName] = useState('');
  const [servingGrams, setServingGrams] = useState(100);
  const [caloriesPer100, setCaloriesPer100] = useState(0);
  const [proteinPer100, setProteinPer100] = useState(0);
  const [carbsPer100, setCarbsPer100] = useState(0);
  const [fatPer100, setFatPer100] = useState(0);
  const [sugarPer100, setSugarPer100] = useState(0);
  const [saturatedFatPer100, setSaturatedFatPer100] = useState(0);
  const [barcode, setBarcode] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FoodProduct[]>([]);
  const [searching, setSearching] = useState(false);

  // Favorites & Recent
  const [favorites, setFavorites] = useState<FoodProduct[]>([]);
  const [recent, setRecent] = useState<FoodProduct[]>([]);

  useEffect(() => {
    if (editId) {
      supabase.from('food_entries').select('*').eq('id', editId).single().then(({ data }) => {
        if (data) {
          setFoodName(data.food_name);
          setMealType(data.meal_type as MealType);
          setServingGrams(data.serving_grams);
          setBarcode(data.barcode);
          const g = data.serving_grams || 100;
          setCaloriesPer100((data.calories / g) * 100);
          setProteinPer100((data.protein / g) * 100);
          setCarbsPer100((data.carbs / g) * 100);
          setFatPer100((data.fat / g) * 100);
          setSugarPer100(((data.sugar || 0) / g) * 100);
          setSaturatedFatPer100(((data.saturated_fat || 0) / g) * 100);
        }
      });
    } else if (prefillParam) {
      try {
        const data = JSON.parse(decodeURIComponent(prefillParam));
        setFoodName(data.name || '');
        setCaloriesPer100(data.calories_per_100g || 0);
        setProteinPer100(data.protein_per_100g || 0);
        setCarbsPer100(data.carbs_per_100g || 0);
        setFatPer100(data.fat_per_100g || 0);
        setSugarPer100(data.sugar_per_100g || 0);
        setSaturatedFatPer100(data.saturated_fat_per_100g || 0);
        setBarcode(data.barcode || null);
        if (data.serving_size) {
          const match = data.serving_size.match(/(\d+)/);
          if (match) setServingGrams(parseInt(match[1]));
        }
      } catch {}
    }
  }, [editId, prefillParam]);

  useEffect(() => {
    loadFavoritesAndRecent();
  }, [user]);

  async function loadFavoritesAndRecent() {
    if (!user) return;
    const { data: favs } = await supabase
      .from('food_favorites')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);
    if (favs) {
      setFavorites(favs.map(f => ({
        name: f.food_name,
        barcode: f.barcode,
        calories_per_100g: f.calories_per_100g || 0,
        protein_per_100g: f.protein_per_100g || 0,
        carbs_per_100g: f.carbs_per_100g || 0,
        fat_per_100g: f.fat_per_100g || 0,
        sugar_per_100g: f.sugar_per_100g || 0,
        saturated_fat_per_100g: f.saturated_fat_per_100g || 0,
      })));
    }

    const { data: recentEntries } = await supabase
      .from('food_entries')
      .select('food_name, barcode, calories, protein, carbs, fat, sugar, saturated_fat, serving_grams')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (recentEntries) {
      const seen = new Set<string>();
      const unique: FoodProduct[] = [];
      for (const e of recentEntries) {
        if (!seen.has(e.food_name)) {
          seen.add(e.food_name);
          unique.push({
            name: e.food_name,
            barcode: e.barcode || undefined,
            calories_per_100g: e.serving_grams > 0 ? (e.calories / e.serving_grams) * 100 : 0,
            protein_per_100g: e.serving_grams > 0 ? (e.protein / e.serving_grams) * 100 : 0,
            carbs_per_100g: e.serving_grams > 0 ? (e.carbs / e.serving_grams) * 100 : 0,
            fat_per_100g: e.serving_grams > 0 ? (e.fat / e.serving_grams) * 100 : 0,
            sugar_per_100g: e.serving_grams > 0 ? ((e.sugar || 0) / e.serving_grams) * 100 : 0,
            saturated_fat_per_100g: e.serving_grams > 0 ? ((e.saturated_fat || 0) / e.serving_grams) * 100 : 0,
          });
        }
      }
      setRecent(unique.slice(0, 10));
    }
  }

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    const results = await searchFood(searchQuery);
    setSearchResults(results);
    setSearching(false);
  }

  function selectProduct(p: FoodProduct) {
    setFoodName(p.name);
    setCaloriesPer100(p.calories_per_100g);
    setProteinPer100(p.protein_per_100g);
    setCarbsPer100(p.carbs_per_100g);
    setFatPer100(p.fat_per_100g);
    setSugarPer100(p.sugar_per_100g || 0);
    setSaturatedFatPer100(p.saturated_fat_per_100g || 0);
    setBarcode(p.barcode || null);
    setSearchResults([]);
    setSearchQuery('');
  }

  const calcValue = (per100: number) => (per100 * servingGrams) / 100;

  async function handleSave() {
    if (!user || !foodName.trim()) {
      toast.error('please enter a food name.');
      return;
    }
    setSaving(true);

    const entryData = {
      meal_type: mealType,
      food_name: foodName.trim(),
      barcode,
      serving_grams: servingGrams,
      calories: calcValue(caloriesPer100),
      protein: calcValue(proteinPer100),
      carbs: calcValue(carbsPer100),
      fat: calcValue(fatPer100),
      sugar: calcValue(sugarPer100),
      saturated_fat: calcValue(saturatedFatPer100),
    };

    let error;
    if (editId) {
      ({ error } = await supabase.from('food_entries').update(entryData).eq('id', editId));
    } else {
      ({ error } = await supabase.from('food_entries').insert({
        user_id: user.id,
        date,
        ...entryData,
      }));
    }

    if (error) {
      console.error('Food save error:', error);
      toast.error(`error: ${error.message}`);
      setSaving(false);
    } else {
      toast.success(editId ? 'entry updated.' : 'entry saved.');
      router.push('/food');
    }
  }

  async function handleSaveAsFavorite() {
    if (!user || !foodName.trim()) return;
    await supabase.from('food_favorites').insert({
      user_id: user.id,
      food_name: foodName.trim(),
      barcode,
      calories_per_100g: caloriesPer100,
      protein_per_100g: proteinPer100,
      carbs_per_100g: carbsPer100,
      fat_per_100g: fatPer100,
      sugar_per_100g: sugarPer100,
      saturated_fat_per_100g: saturatedFatPer100,
    });
    toast.success('saved as favorite.');
  }

  return (
    <div className="mx-auto max-w-md p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/food"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <h1 className="text-xl font-bold">{editId ? 'edit entry' : 'add food'}</h1>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <Input
          placeholder="search product..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <Button onClick={handleSearch} disabled={searching} size="icon" variant="outline">
          <Search className="h-4 w-4" />
        </Button>
      </div>

      {searchResults.length > 0 && (
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {searchResults.map((p, i) => (
            <Card key={i} className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => selectProduct(p)}>
              <CardContent className="p-2 text-sm">
                <p className="font-medium truncate">{p.name}</p>
                <p className="text-xs text-muted-foreground font-mono">{Math.round(p.calories_per_100g)} kcal/100g</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground">or</span>
        <Separator className="flex-1" />
      </div>

      <Button variant="outline" className="w-full" asChild>
        <Link href={`/food/scan?date=${date}`}>
          <ScanBarcode className="mr-2 h-4 w-4" />
          scan barcode
        </Link>
      </Button>

      <Separator />

      {/* Entry Form */}
      <div className="space-y-3">
        <div className="space-y-2">
          <Label>Meal</Label>
          <Select value={mealType} onValueChange={(v) => setMealType(v as MealType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(MEAL_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Product Name</Label>
          <Input value={foodName} onChange={(e) => setFoodName(e.target.value)} placeholder="e.g. Oatmeal" />
        </div>

        <div className="space-y-2">
          <Label>Serving (g)</Label>
          <Input type="number" value={servingGrams || ''} onChange={(e) => setServingGrams(Number(e.target.value))} />
        </div>

        <p className="text-xs text-muted-foreground">nutrition per 100g:</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Calories</Label>
            <Input type="number" value={caloriesPer100 || ''} onChange={(e) => setCaloriesPer100(Number(e.target.value))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Protein (g)</Label>
            <Input type="number" value={proteinPer100 || ''} onChange={(e) => setProteinPer100(Number(e.target.value))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Carbs (g)</Label>
            <Input type="number" value={carbsPer100 || ''} onChange={(e) => setCarbsPer100(Number(e.target.value))} />
          </div>
          <div className="space-y-1 pl-3 border-l-2 border-amber-500/30">
            <Label className="text-xs text-muted-foreground">of which sugar (g)</Label>
            <Input type="number" value={sugarPer100 || ''} onChange={(e) => setSugarPer100(Number(e.target.value))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Fat (g)</Label>
            <Input type="number" value={fatPer100 || ''} onChange={(e) => setFatPer100(Number(e.target.value))} />
          </div>
          <div className="space-y-1 pl-3 border-l-2 border-rose-500/30">
            <Label className="text-xs text-muted-foreground">of which saturated (g)</Label>
            <Input type="number" value={saturatedFatPer100 || ''} onChange={(e) => setSaturatedFatPer100(Number(e.target.value))} />
          </div>
        </div>

        {/* Calculated values */}
        <Card className="bg-[#222222]">
          <CardContent className="p-3">
            <p className="text-sm font-medium mb-1">calculated ({servingGrams}g):</p>
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div>
                <p className="text-lg font-bold font-mono">{Math.round(calcValue(caloriesPer100))}</p>
                <p className="text-muted-foreground">kcal</p>
              </div>
              <div>
                <p className="text-lg font-bold font-mono text-[#004AC2]">{Math.round(calcValue(proteinPer100))}</p>
                <p className="text-muted-foreground">protein</p>
              </div>
              <div>
                <p className="text-lg font-bold font-mono text-[#0096FF]">{Math.round(calcValue(carbsPer100))}</p>
                <p className="text-muted-foreground">carbs</p>
                <p className="text-[10px] text-muted-foreground">sugar: {Math.round(calcValue(sugarPer100))}g</p>
              </div>
              <div>
                <p className="text-lg font-bold font-mono text-[#2DCAEF]">{Math.round(calcValue(fatPer100))}</p>
                <p className="text-muted-foreground">fat</p>
                <p className="text-[10px] text-muted-foreground">sat: {Math.round(calcValue(saturatedFatPer100))}g</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button onClick={handleSave} className="flex-1" disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'saving...' : editId ? 'update' : 'save'}
          </Button>
          <Button onClick={handleSaveAsFavorite} variant="outline" size="icon" disabled={!foodName.trim()}>
            <Star className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Favorites */}
      {favorites.length > 0 && (
        <>
          <Separator />
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-1 mb-2">
              <Star className="h-3 w-3" /> favorites
            </h2>
            <div className="space-y-1">
              {favorites.map((f, i) => (
                <Card key={i} className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => selectProduct(f)}>
                  <CardContent className="p-2 text-sm">
                    <p className="font-medium truncate">{f.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{Math.round(f.calories_per_100g)} kcal/100g</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Recent */}
      {recent.length > 0 && (
        <>
          <Separator />
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-1 mb-2">
              <Clock className="h-3 w-3" /> recent
            </h2>
            <div className="space-y-1">
              {recent.map((f, i) => (
                <Card key={i} className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => selectProduct(f)}>
                  <CardContent className="p-2 text-sm">
                    <p className="font-medium truncate">{f.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{Math.round(f.calories_per_100g)} kcal/100g</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
