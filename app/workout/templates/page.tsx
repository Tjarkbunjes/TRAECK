'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/hooks';
import { exercises as exerciseDB, searchExercises, muscleGroups } from '@/lib/exercises';
import { MUSCLE_GROUP_LABELS, type TemplateExercise, type WorkoutTemplate } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Plus, Trash2, Save, Search, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

export default function TemplatesPage() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<WorkoutTemplate | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formExercises, setFormExercises] = useState<TemplateExercise[]>([]);
  const [showExerciseDialog, setShowExerciseDialog] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  useEffect(() => {
    if (user) loadTemplates();
  }, [user]);

  async function loadTemplates() {
    if (!user) return;
    const { data } = await supabase
      .from('workout_templates')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (data) setTemplates(data);
  }

  function startCreate() {
    setEditingTemplate(null);
    setFormName('');
    setFormExercises([]);
    setShowForm(true);
  }

  function startEdit(template: WorkoutTemplate) {
    setEditingTemplate(template);
    setFormName(template.name);
    setFormExercises([...template.exercises]);
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingTemplate(null);
    setFormName('');
    setFormExercises([]);
  }

  async function handleSave() {
    if (!user || !formName.trim() || formExercises.length === 0) {
      toast.error('name and at least one exercise required.');
      return;
    }

    if (editingTemplate) {
      // Update existing template
      const { error } = await supabase
        .from('workout_templates')
        .update({
          name: formName.trim(),
          exercises: formExercises,
        })
        .eq('id', editingTemplate.id);
      if (error) {
        console.error('Template update error:', error);
        toast.error(`error: ${error.message}`);
      } else {
        toast.success('template updated.');
        cancelForm();
        loadTemplates();
      }
    } else {
      // Create new template
      const { error } = await supabase.from('workout_templates').insert({
        user_id: user.id,
        name: formName.trim(),
        exercises: formExercises,
      });
      if (error) {
        console.error('Template save error:', error);
        toast.error(`error: ${error.message}`);
      } else {
        toast.success('template saved.');
        cancelForm();
        loadTemplates();
      }
    }
  }

  async function deleteTemplate(id: string) {
    const { error } = await supabase.from('workout_templates').delete().eq('id', id);
    if (error) {
      toast.error(`Error: ${error.message}`);
    } else {
      toast.success('template deleted.');
      loadTemplates();
    }
  }

  function addExerciseToForm(name: string, muscleGroup: string) {
    setFormExercises(prev => [...prev, { exercise_name: name, muscle_group: muscleGroup, default_sets: 3 }]);
    setShowExerciseDialog(false);
    setExerciseSearch('');
  }

  const filteredExercises = exerciseSearch
    ? searchExercises(exerciseSearch)
    : selectedGroup
    ? exerciseDB.filter(e => e.muscleGroup === selectedGroup)
    : exerciseDB;

  return (
    <div className="mx-auto max-w-md p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/workout"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <h1 className="text-xl font-bold">workout templates</h1>
      </div>

      {!showForm ? (
        <>
          <Button onClick={startCreate} className="w-full">
            <Plus className="mr-2 h-4 w-4" />
            create new template
          </Button>

          <div className="space-y-2">
            {templates.map((t) => (
              <Card key={t.id}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {t.exercises.map(e => e.exercise_name).join(', ')}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        onClick={() => startEdit(t)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteTemplate(t.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {templates.length === 0 && (
              <p className="text-center text-muted-foreground py-4 text-sm">
                no templates yet.
              </p>
            )}
          </div>
        </>
      ) : (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground">
            {editingTemplate ? 'edit template' : 'new template'}
          </h2>

          <div className="space-y-2">
            <Label>Template Name</Label>
            <Input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. Push Day"
            />
          </div>

          {formExercises.length > 0 && (
            <div className="space-y-2">
              {formExercises.map((ex, i) => (
                <div key={i} className="flex items-center justify-between bg-muted/30 rounded-md p-2">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium">{ex.exercise_name}</span>
                    <span className="text-xs text-muted-foreground ml-2">{ex.default_sets} sets</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min={1}
                      max={20}
                      value={ex.default_sets}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 1;
                        setFormExercises(prev => prev.map((item, idx) =>
                          idx === i ? { ...item, default_sets: val } : item
                        ));
                      }}
                      className="h-7 w-14 text-center text-xs"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setFormExercises(prev => prev.filter((_, idx) => idx !== i))}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Dialog open={showExerciseDialog} onOpenChange={setShowExerciseDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full">
                <Plus className="mr-2 h-4 w-4" />
                add exercise
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>choose exercise</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="search exercise..."
                    value={exerciseSearch}
                    onChange={(e) => { setExerciseSearch(e.target.value); setSelectedGroup(null); }}
                    className="pl-9"
                  />
                </div>
                {!exerciseSearch && (
                  <div className="flex flex-wrap gap-1.5">
                    {muscleGroups.map(g => (
                      <Badge
                        key={g}
                        variant={selectedGroup === g ? 'default' : 'secondary'}
                        className="cursor-pointer"
                        onClick={() => setSelectedGroup(selectedGroup === g ? null : g)}
                      >
                        {MUSCLE_GROUP_LABELS[g] || g}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {filteredExercises.map((ex, i) => (
                    <button
                      key={i}
                      onClick={() => addExerciseToForm(ex.name, ex.muscleGroup)}
                      className="w-full text-left p-2 rounded-md hover:bg-accent/50 transition-colors text-sm"
                    >
                      {ex.name}
                    </button>
                  ))}
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Separator />

          <div className="flex gap-2">
            <Button onClick={handleSave} className="flex-1">
              <Save className="mr-2 h-4 w-4" />
              {editingTemplate ? 'update' : 'save'}
            </Button>
            <Button variant="outline" onClick={cancelForm}>
              cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
