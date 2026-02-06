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
import { ArrowLeft, Plus, Trash2, Save, Search, Pencil, UtensilsCrossed } from 'lucide-react';
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
  const [newItem, setNewItem] = useState<MealTemplateItem>({
    food_name: '', serving_grams: 100, calories: 0, protein: 0, carbs: 0, fat: 0, sugar: 0, saturated_fat: 0,
  });

  useEffect(() => {
    if (user) loadMeals();
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
      toast.error('Name und mindestens ein Lebensmittel benötigt');
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
      toast.error(`Fehler: ${error.message}`);
    } else {
      toast.success(editId ? 'Mahlzeit aktualisiert' : 'Mahlzeit gespeichert');
      cancelEdit();
      loadMeals();
    }
  }

  async function deleteMeal(id: string) {
    await supabase.from('meal_templates').delete().eq('id', id);
    toast.success('Mahlzeit gelöscht');
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
    // Recalculate macros based on new serving size if we have per-100g base values
    // We store absolute values for the serving, so if user changes grams,
    // we need the per-100g base. We'll store it as absolute for the given serving.
    setNewItem(prev => ({ ...prev, serving_grams: grams }));
  }

  function addItemToMeal() {
    if (!newItem.food_name.trim()) {
      toast.error('Bitte Lebensmittel-Name eingeben');
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
    return <div className="flex h-64 items-center justify-center text-muted-foreground">Laden...</div>;
  }

  return (
    <div className="mx-auto max-w-md p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/food"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <h1 className="text-xl font-bold">Mahlzeiten</h1>
      </div>

      {!editing ? (
        <>
          <Button onClick={startCreate} className="w-full">
            <Plus className="mr-2 h-4 w-4" />
            Neue Mahlzeit erstellen
          </Button>

          {meals.length === 0 ? (
            <div className="text-center py-8">
              <UtensilsCrossed className="mx-auto h-10 w-10 text-muted-foreground mb-2" />
              <p className="text-muted-foreground text-sm">
                Noch keine Mahlzeiten gespeichert.
              </p>
              <p className="text-muted-foreground text-xs mt-1">
                Erstelle Mahlzeiten um sie schnell wiederverwenden zu können.
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
                          {meal.items.length} Lebensmittel
                        </p>
                        <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                          <span className="font-medium text-foreground">{Math.round(meal.total_calories)} kcal</span>
                          <span>P: {Math.round(meal.total_protein)}g</span>
                          <span>K: {Math.round(meal.total_carbs)}g</span>
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
            <Label>Mahlzeit-Name</Label>
            <Input
              value={mealName}
              onChange={(e) => setMealName(e.target.value)}
              placeholder="z.B. Frühstück Bowl, Post-Workout Shake"
            />
          </div>

          <div className="space-y-2">
            <Label>Standard-Mahlzeit (optional)</Label>
            <Select value={mealType} onValueChange={setMealType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Keine Zuordnung</SelectItem>
                {Object.entries(MEAL_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Items list */}
          <div>
            <h3 className="text-sm font-semibold mb-2">Lebensmittel ({items.length})</h3>
            {items.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">Noch keine Lebensmittel hinzugefügt.</p>
            ) : (
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-muted/30 rounded-md p-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.food_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.serving_grams}g — {Math.round(item.calories)} kcal | P: {Math.round(item.protein)}g | K: {Math.round(item.carbs)}g | F: {Math.round(item.fat)}g
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
            <Card className="bg-muted/30">
              <CardContent className="p-3">
                <p className="text-sm font-medium mb-1">Gesamt:</p>
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div>
                    <p className="text-lg font-bold">{Math.round(totals.calories)}</p>
                    <p className="text-muted-foreground">kcal</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-blue-500">{Math.round(totals.protein)}</p>
                    <p className="text-muted-foreground">Protein</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-amber-500">{Math.round(totals.carbs)}</p>
                    <p className="text-muted-foreground">Carbs</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-rose-500">{Math.round(totals.fat)}</p>
                    <p className="text-muted-foreground">Fett</p>
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
                Lebensmittel hinzufügen
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Lebensmittel hinzufügen</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                {/* Search */}
                <div className="flex gap-2">
                  <Input
                    placeholder="Produkt suchen..."
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

                <Separator />

                {/* Manual entry */}
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={newItem.food_name}
                    onChange={(e) => setNewItem(prev => ({ ...prev, food_name: e.target.value }))}
                    placeholder="z.B. Haferflocken"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Portion (g)</Label>
                  <Input
                    type="number"
                    value={newItem.serving_grams}
                    onChange={(e) => updateNewItemServing(Number(e.target.value))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Kalorien</Label>
                    <Input type="number" value={newItem.calories} onChange={(e) => setNewItem(prev => ({ ...prev, calories: Number(e.target.value) }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Protein (g)</Label>
                    <Input type="number" value={newItem.protein} onChange={(e) => setNewItem(prev => ({ ...prev, protein: Number(e.target.value) }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Kohlenhydrate (g)</Label>
                    <Input type="number" value={newItem.carbs} onChange={(e) => setNewItem(prev => ({ ...prev, carbs: Number(e.target.value) }))} />
                  </div>
                  <div className="space-y-1 pl-3 border-l-2 border-amber-500/30">
                    <Label className="text-xs text-muted-foreground">dav. Zucker (g)</Label>
                    <Input type="number" value={newItem.sugar || 0} onChange={(e) => setNewItem(prev => ({ ...prev, sugar: Number(e.target.value) }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Fett (g)</Label>
                    <Input type="number" value={newItem.fat} onChange={(e) => setNewItem(prev => ({ ...prev, fat: Number(e.target.value) }))} />
                  </div>
                  <div className="space-y-1 pl-3 border-l-2 border-rose-500/30">
                    <Label className="text-xs text-muted-foreground">dav. ges. Fettsäuren (g)</Label>
                    <Input type="number" value={newItem.saturated_fat || 0} onChange={(e) => setNewItem(prev => ({ ...prev, saturated_fat: Number(e.target.value) }))} />
                  </div>
                </div>

                <Button onClick={addItemToMeal} className="w-full">
                  <Plus className="mr-2 h-4 w-4" />
                  Hinzufügen
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Separator />

          <div className="flex gap-2">
            <Button onClick={handleSave} className="flex-1">
              <Save className="mr-2 h-4 w-4" />
              {editId ? 'Aktualisieren' : 'Speichern'}
            </Button>
            <Button variant="outline" onClick={cancelEdit}>
              Abbrechen
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
