'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { searchFood } from '@/lib/food-api';
import { useAuth } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ArrowLeft, Plus, Trash2, Save, Search, Pencil, UtensilsCrossed, Clock } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import type { MealTemplate, MealTemplateItem, MealType, FoodProduct } from '@/lib/types';
import { MEAL_LABELS } from '@/lib/types';

export default function MealsPage() {
  const { user } = useAuth();
  const [meals, setMeals] = useState<MealTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  // Create/Edit state
  const [editing, setEditing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [mealName, setMealName] = useState('');
  const [mealType, setMealType] = useState<string>('none');
  const [items, setItems] = useState<MealTemplateItem[]>([]);

  // Add item state
  const [showAddItem, setShowAddItem] = useState(false);
  const [itemSearch, setItemSearch] = useState('');
  const [searchResults, setSearchResults] = useState<FoodProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [recentFoods, setRecentFoods] = useState<FoodProduct[]>([]);
  const [newItem, setNewItem] = useState<MealTemplateItem>({
    food_name: '', serving_grams: 100, calories: 0, protein: 0, carbs: 0, fat: 0, sugar: 0, saturated_fat: 0,
  });

  useEffect(() => {
    if (user) {
      loadMeals();
      loadRecentFoods();
    }
  }, [user]);

  async function loadMeals() {
    if (!user) return;
    const { data } = await supabase
      .from('meal_templates')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (data) setMeals(data as MealTemplate[]);
    setLoading(false);
  }

  async function loadRecentFoods() {
    if (!user) return;
    const { data } = await supabase
      .from('food_entries')
      .select('food_name, barcode, calories, protein, carbs, fat, sugar, saturated_fat, serving_grams')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(500);
    if (data) {
      const seen = new Set<string>();
      const unique: FoodProduct[] = [];
      for (const e of data) {
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
      setRecentFoods(unique);
    }
  }

  function startCreate() {
    setEditing(true);
    setEditId(null);
    setMealName('');
    setMealType('none');
    setItems([]);
  }

  function startEdit(meal: MealTemplate) {
    setEditing(true);
    setEditId(meal.id);
    setMealName(meal.name);
    setMealType(meal.meal_type || 'none');
    setItems([...meal.items]);
  }

  function cancelEdit() {
    setEditing(false);
    setEditId(null);
    setMealName('');
    setMealType('none');
    setItems([]);
  }

  const totals = items.reduce(
    (acc, item) => ({
      calories: acc.calories + item.calories,
      protein: acc.protein + item.protein,
      carbs: acc.carbs + item.carbs,
      fat: acc.fat + item.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  async function handleSave() {
    if (!user || !mealName.trim() || items.length === 0) {
      toast.error('name and at least one food item required.');
      return;
    }

    const mealData = {
      user_id: user.id,
      name: mealName.trim(),
      meal_type: mealType === 'none' ? null : mealType,
      items,
      total_calories: totals.calories,
      total_protein: totals.protein,
      total_carbs: totals.carbs,
      total_fat: totals.fat,
    };

    let error;
    if (editId) {
      ({ error } = await supabase.from('meal_templates').update(mealData).eq('id', editId));
    } else {
      ({ error } = await supabase.from('meal_templates').insert(mealData));
    }

    if (error) {
      console.error('Meal save error:', error);
      toast.error(`error: ${error.message}`);
    } else {
      toast.success(editId ? 'meal updated.' : 'meal saved.');
      cancelEdit();
      loadMeals();
    }
  }

  async function deleteMeal(id: string) {
    await supabase.from('meal_templates').delete().eq('id', id);
    toast.success('meal deleted.');
    loadMeals();
  }

  async function handleItemSearch() {
    if (!itemSearch.trim()) return;
    setSearching(true);
    const results = await searchFood(itemSearch);
    setSearchResults(results);
    setSearching(false);
  }

  function selectSearchResult(p: FoodProduct) {
    setNewItem({
      food_name: p.name,
      serving_grams: 100,
      calories: Math.round(p.calories_per_100g),
      protein: Math.round(p.protein_per_100g * 10) / 10,
      carbs: Math.round(p.carbs_per_100g * 10) / 10,
      fat: Math.round(p.fat_per_100g * 10) / 10,
      sugar: Math.round((p.sugar_per_100g || 0) * 10) / 10,
      saturated_fat: Math.round((p.saturated_fat_per_100g || 0) * 10) / 10,
      barcode: p.barcode,
    });
    setSearchResults([]);
    setItemSearch('');
  }

  function updateNewItemServing(grams: number) {
    setNewItem(prev => ({ ...prev, serving_grams: grams }));
  }

  function addItemToMeal() {
    if (!newItem.food_name.trim()) {
      toast.error('please enter a food name.');
      return;
    }
    setItems(prev => [...prev, { ...newItem }]);
    setNewItem({ food_name: '', serving_grams: 100, calories: 0, protein: 0, carbs: 0, fat: 0, sugar: 0, saturated_fat: 0 });
    setShowAddItem(false);
  }

  function removeItem(index: number) {
    setItems(prev => prev.filter((_, i) => i !== index));
  }

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-muted-foreground">loading...</div>;
  }

  return (
    <div className="mx-auto max-w-md p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/food"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <h1 className="text-xl font-bold">meals</h1>
      </div>

      {!editing ? (
        <>
          <Button onClick={startCreate} className="w-full">
            <Plus className="mr-2 h-4 w-4" />
            create new meal
          </Button>

          {meals.length === 0 ? (
            <div className="text-center py-8">
              <UtensilsCrossed className="mx-auto h-10 w-10 text-muted-foreground mb-2" />
              <p className="text-muted-foreground text-sm">
                no meals saved yet.
              </p>
              <p className="text-muted-foreground text-xs mt-1">
                create meals to quickly reuse them.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {meals.map((meal) => (
                <Card key={meal.id}>
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium truncate">{meal.name}</span>
                          {meal.meal_type && (
                            <Badge variant="secondary" className="text-[10px] shrink-0">
                              {MEAL_LABELS[meal.meal_type as MealType]}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {meal.items.length} items
                        </p>
                        <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                          <span className="font-medium text-foreground">{Math.round(meal.total_calories)} kcal</span>
                          <span>P: {Math.round(meal.total_protein)}g</span>
                          <span>C: {Math.round(meal.total_carbs)}g</span>
                          <span>F: {Math.round(meal.total_fat)}g</span>
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => startEdit(meal)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteMeal(meal.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      ) : (
        /* ---- EDIT / CREATE MODE ---- */
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Meal Name</Label>
            <Input
              value={mealName}
              onChange={(e) => setMealName(e.target.value)}
              placeholder="e.g. Breakfast Bowl, Post-Workout Shake"
            />
          </div>

          <div className="space-y-2">
            <Label>Default Meal Type (optional)</Label>
            <Select value={mealType} onValueChange={setMealType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No assignment</SelectItem>
                {Object.entries(MEAL_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Items list */}
          <div>
            <h3 className="text-sm font-semibold mb-2">food items ({items.length})</h3>
            {items.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">no food items added yet.</p>
            ) : (
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-[#222222] border border-[#292929] rounded-md p-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.food_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.serving_grams}g — {Math.round(item.calories)} kcal | P: {Math.round(item.protein)}g | C: {Math.round(item.carbs)}g | F: {Math.round(item.fat)}g
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeItem(idx)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Totals */}
          {items.length > 0 && (
            <Card className="bg-[#222222]">
              <CardContent className="p-3">
                <p className="text-sm font-medium mb-1">total:</p>
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div>
                    <p className="text-lg font-bold font-mono">{Math.round(totals.calories)}</p>
                    <p className="text-muted-foreground">kcal</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold font-mono text-[#004AC2]">{Math.round(totals.protein)}</p>
                    <p className="text-muted-foreground">protein</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold font-mono text-[#0096FF]">{Math.round(totals.carbs)}</p>
                    <p className="text-muted-foreground">carbs</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold font-mono text-[#2DCAEF]">{Math.round(totals.fat)}</p>
                    <p className="text-muted-foreground">fat</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Add Item Dialog */}
          <Dialog open={showAddItem} onOpenChange={setShowAddItem}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full">
                <Plus className="mr-2 h-4 w-4" />
                add food item
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto p-4">
              <DialogHeader>
                <DialogTitle>add food item</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                {/* Search */}
                <div className="flex gap-2">
                  <Input
                    placeholder="search product..."
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleItemSearch()}
                  />
                  <Button onClick={handleItemSearch} disabled={searching} size="icon" variant="outline">
                    <Search className="h-4 w-4" />
                  </Button>
                </div>

                {searchResults.length > 0 && (
                  <div className="space-y-1 max-h-36 overflow-y-auto">
                    {searchResults.map((p, i) => (
                      <div
                        key={i}
                        className="cursor-pointer rounded-md p-2 hover:bg-accent/50 transition-colors text-sm"
                        onClick={() => selectSearchResult(p)}
                      >
                        <p className="font-medium truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{Math.round(p.calories_per_100g)} kcal/100g</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Recent foods */}
                {recentFoods.length > 0 && !searchResults.length && (
                  <>
                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-1 mb-2">
                        <Clock className="h-3 w-3" /> recent
                      </h3>
                      <div className="space-y-1 max-h-36 overflow-y-auto">
                        {recentFoods.slice(0, 20).map((p, i) => (
                          <div
                            key={i}
                            className="cursor-pointer rounded-md p-2 hover:bg-accent/50 transition-colors text-sm"
                            onClick={() => selectSearchResult(p)}
                          >
                            <p className="font-medium truncate">{p.name}</p>
                            <p className="text-xs text-muted-foreground">{Math.round(p.calories_per_100g)} kcal/100g</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                <Separator />

                {/* Manual entry */}
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={newItem.food_name}
                    onChange={(e) => setNewItem(prev => ({ ...prev, food_name: e.target.value }))}
                    placeholder="e.g. Oats"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Serving (g)</Label>
                  <Input
                    type="number"
                    value={newItem.serving_grams}
                    onChange={(e) => updateNewItemServing(Number(e.target.value))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Calories</Label>
                    <Input type="number" value={newItem.calories} onChange={(e) => setNewItem(prev => ({ ...prev, calories: Number(e.target.value) }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Protein (g)</Label>
                    <Input type="number" value={newItem.protein} onChange={(e) => setNewItem(prev => ({ ...prev, protein: Number(e.target.value) }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Carbs (g)</Label>
                    <Input type="number" value={newItem.carbs} onChange={(e) => setNewItem(prev => ({ ...prev, carbs: Number(e.target.value) }))} />
                  </div>
                  <div className="space-y-1 pl-3 border-l-2 border-amber-500/30">
                    <Label className="text-xs text-muted-foreground">of which sugar (g)</Label>
                    <Input type="number" value={newItem.sugar || 0} onChange={(e) => setNewItem(prev => ({ ...prev, sugar: Number(e.target.value) }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Fat (g)</Label>
                    <Input type="number" value={newItem.fat} onChange={(e) => setNewItem(prev => ({ ...prev, fat: Number(e.target.value) }))} />
                  </div>
                  <div className="space-y-1 pl-3 border-l-2 border-rose-500/30">
                    <Label className="text-xs text-muted-foreground">of which saturated (g)</Label>
                    <Input type="number" value={newItem.saturated_fat || 0} onChange={(e) => setNewItem(prev => ({ ...prev, saturated_fat: Number(e.target.value) }))} />
                  </div>
                </div>

                <Button onClick={addItemToMeal} className="w-full">
                  <Plus className="mr-2 h-4 w-4" />
                  add
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Separator />

          <div className="flex gap-2">
            <Button onClick={handleSave} className="flex-1">
              <Save className="mr-2 h-4 w-4" />
              {editId ? 'update' : 'save'}
            </Button>
            <Button variant="outline" onClick={cancelEdit}>
              cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
