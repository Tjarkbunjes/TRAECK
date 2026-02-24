'use client';

import { Suspense, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/hooks';
import { analyzeFood } from '@/lib/ai-food';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Camera, ImagePlus, Loader2, Sparkles, X, Save } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { MEAL_LABELS, type MealType, type AIFoodResult } from '@/lib/types';
import Link from 'next/link';

type PageState = 'capture' | 'analyzing' | 'review';

export default function AIFoodPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center text-muted-foreground">loading...</div>}>
      <AIFoodPageInner />
    </Suspense>
  );
}

function AIFoodPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const date = searchParams.get('date') || format(new Date(), 'yyyy-MM-dd');
  const { user } = useAuth();

  const [state, setState] = useState<PageState>('capture');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [results, setResults] = useState<(AIFoodResult & { mealType: MealType })[]>([]);
  const [saving, setSaving] = useState(false);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  function removeImage() {
    setImageFile(null);
    setImagePreview(null);
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (galleryInputRef.current) galleryInputRef.current.value = '';
  }

  async function handleAnalyze() {
    if (!imageFile || !user) return;

    setState('analyzing');
    try {
      const foods = await analyzeFood(imageFile, user.id, description || undefined);
      setResults(foods.map(f => ({ ...f, mealType: 'lunch' as MealType })));
      setState('review');
      toast.success(`${foods.length} item${foods.length !== 1 ? 's' : ''} detected.`);
    } catch (err) {
      console.error('AI analysis error:', err);
      toast.error(err instanceof Error ? err.message : 'Analysis failed.');
      setState('capture');
    }
  }

  function updateResult(index: number, field: string, value: string | number) {
    setResults(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r));
  }

  function removeResult(index: number) {
    setResults(prev => prev.filter((_, i) => i !== index));
  }

  async function handleSaveAll() {
    if (!user || results.length === 0) return;
    setSaving(true);

    const entries = results.map(r => ({
      user_id: user.id,
      date,
      meal_type: r.mealType,
      food_name: r.name,
      barcode: null,
      serving_grams: r.serving_grams,
      calories: r.calories,
      protein: r.protein,
      carbs: r.carbs,
      fat: r.fat,
      sugar: r.sugar,
      saturated_fat: r.saturated_fat,
    }));

    const { error } = await supabase.from('food_entries').insert(entries);

    if (error) {
      console.error('Save error:', error);
      toast.error(`error: ${error.message}`);
      setSaving(false);
    } else {
      toast.success(`${entries.length} item${entries.length !== 1 ? 's' : ''} saved.`);
      router.push('/food');
    }
  }

  function handleRetry() {
    setResults([]);
    setState('capture');
  }

  return (
    <div className="mx-auto max-w-md p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/food"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          AI food scan
        </h1>
      </div>

      {/* ── CAPTURE STATE ── */}
      {state === 'capture' && (
        <div className="space-y-4">
          {/* Image Preview or Upload Buttons */}
          {imagePreview ? (
            <div className="relative">
              <img
                src={imagePreview}
                alt="Food"
                className="w-full rounded-lg object-cover max-h-64"
              />
              <Button
                variant="secondary"
                size="icon"
                className="absolute top-2 right-2 h-8 w-8 rounded-full"
                onClick={removeImage}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-border p-8 transition-colors hover:border-primary hover:bg-accent/50"
              >
                <Camera className="h-8 w-8 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">take photo</span>
              </button>
              <button
                onClick={() => galleryInputRef.current?.click()}
                className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-border p-8 transition-colors hover:border-primary hover:bg-accent/50"
              >
                <ImagePlus className="h-8 w-8 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">from gallery</span>
              </button>
            </div>
          )}

          {/* Hidden file inputs */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleImageSelect}
          />
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageSelect}
          />

          {/* Description */}
          <Textarea
            placeholder="optional: describe your food (e.g. 200g chicken breast with rice)..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="resize-none"
          />

          {/* Analyze Button */}
          <Button
            onClick={handleAnalyze}
            disabled={!imageFile}
            className="w-full h-12"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            analyze
          </Button>
        </div>
      )}

      {/* ── ANALYZING STATE ── */}
      {state === 'analyzing' && (
        <div className="flex flex-col items-center gap-4 py-12">
          {imagePreview && (
            <img
              src={imagePreview}
              alt="Food"
              className="w-32 h-32 rounded-lg object-cover opacity-75"
            />
          )}
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">analyzing your food...</p>
          <p className="text-xs text-muted-foreground">this may take a few seconds</p>
        </div>
      )}

      {/* ── REVIEW STATE ── */}
      {state === 'review' && (
        <div className="space-y-4">
          {/* Small image preview */}
          {imagePreview && (
            <img
              src={imagePreview}
              alt="Food"
              className="w-full rounded-lg object-cover max-h-32"
            />
          )}

          <p className="text-sm text-muted-foreground">
            {results.length} item{results.length !== 1 ? 's' : ''} detected — review and edit before saving:
          </p>

          {results.map((item, index) => (
            <Card key={index}>
              <CardContent className="p-3 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <Input
                    value={item.name}
                    onChange={(e) => updateResult(index, 'name', e.target.value)}
                    className="font-medium"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => removeResult(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Meal type */}
                <div className="flex gap-1">
                  {(Object.entries(MEAL_LABELS) as [MealType, string][]).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => updateResult(index, 'mealType', key)}
                      className={`flex-1 py-1.5 text-[10px] rounded-md transition-colors ${
                        item.mealType === key
                          ? 'bg-[#2626FF] text-white'
                          : 'bg-[#1E1E1E] text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Serving */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-16">serving (g)</span>
                  <Input
                    type="number"
                    value={item.serving_grams || ''}
                    onChange={(e) => updateResult(index, 'serving_grams', Number(e.target.value))}
                    className="h-8 text-sm"
                  />
                </div>

                {/* Macros grid */}
                <div className="grid grid-cols-4 gap-2">
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground text-center">kcal</p>
                    <Input
                      type="number"
                      value={item.calories || ''}
                      onChange={(e) => updateResult(index, 'calories', Number(e.target.value))}
                      className="h-8 text-sm text-center font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-[#004AC2] text-center">protein</p>
                    <Input
                      type="number"
                      value={item.protein || ''}
                      onChange={(e) => updateResult(index, 'protein', Number(e.target.value))}
                      className="h-8 text-sm text-center font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-[#0096FF] text-center">carbs</p>
                    <Input
                      type="number"
                      value={item.carbs || ''}
                      onChange={(e) => updateResult(index, 'carbs', Number(e.target.value))}
                      className="h-8 text-sm text-center font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-[#2DCAEF] text-center">fat</p>
                    <Input
                      type="number"
                      value={item.fat || ''}
                      onChange={(e) => updateResult(index, 'fat', Number(e.target.value))}
                      className="h-8 text-sm text-center font-mono"
                    />
                  </div>
                </div>

                {/* Sugar & Saturated Fat */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground shrink-0">sugar</span>
                    <Input
                      type="number"
                      value={item.sugar || ''}
                      onChange={(e) => updateResult(index, 'sugar', Number(e.target.value))}
                      className="h-7 text-xs font-mono"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground shrink-0">sat. fat</span>
                    <Input
                      type="number"
                      value={item.saturated_fat || ''}
                      onChange={(e) => updateResult(index, 'saturated_fat', Number(e.target.value))}
                      className="h-7 text-xs font-mono"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {results.length === 0 && (
            <p className="text-center text-muted-foreground py-4">
              all items removed.
            </p>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              onClick={handleSaveAll}
              className="flex-1"
              disabled={saving || results.length === 0}
            >
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'saving...' : `save ${results.length} item${results.length !== 1 ? 's' : ''}`}
            </Button>
            <Button onClick={handleRetry} variant="outline" className="flex-1">
              try again
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
