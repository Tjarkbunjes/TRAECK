'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { Deck, SchemaMode } from '../types';
import { CARDS_ACCENT_PRESETS } from '../settings';
import { possibleParents } from '../model/decks';
import { newId, nowIso, putDeck, softDeleteDeck } from '../repo';

const NO_PARENT = '__none__';

interface DeckDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  decks: Deck[];
  userId: string;
  /** edit mode when set */
  deck?: Deck | null;
  defaultParentId?: string | null;
  onSaved?: (deck: Deck) => void;
  onDeleted?: () => void;
}

interface DeckForm {
  name: string;
  description: string;
  parent_id: string;
  color: string | null;
  daily_new_limit: string;
  daily_review_limit: string;
  schema_mode: SchemaMode;
  request_retention: string;
}

function formFrom(deck: Deck | null | undefined, defaultParentId: string | null | undefined): DeckForm {
  return {
    name: deck?.name ?? '',
    description: deck?.description ?? '',
    parent_id: deck?.parent_id ?? defaultParentId ?? NO_PARENT,
    color: deck?.color ?? null,
    daily_new_limit: String(deck?.daily_new_limit ?? 20),
    daily_review_limit: String(deck?.daily_review_limit ?? 200),
    schema_mode: deck?.fsrs_params?.schema_mode ?? 'whole',
    request_retention: deck?.fsrs_params?.request_retention !== undefined ? String(deck.fsrs_params.request_retention) : '',
  };
}

function intOr(value: string, fallback: number, min: number, max: number): number {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

export function DeckDialog(props: DeckDialogProps) {
  const { open, onOpenChange, deck } = props;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{deck ? 'deck bearbeiten' : 'neues deck'}</DialogTitle>
        </DialogHeader>
        {/* DialogContent unmounts on close, so the form re-seeds from props on every open */}
        {open && <DeckForm {...props} />}
      </DialogContent>
    </Dialog>
  );
}

function DeckForm({ onOpenChange, decks, userId, deck, defaultParentId, onSaved, onDeleted }: DeckDialogProps) {
  const [form, setForm] = useState<DeckForm>(() => formFrom(deck, defaultParentId));
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const parents = possibleParents(decks, deck?.id ?? null);
  const set = <K extends keyof DeckForm>(key: K, value: DeckForm[K]) => setForm((f) => ({ ...f, [key]: value }));
  async function handleSave() {
    const name = form.name.trim();
    if (!name) return;
    setSaving(true);
    const retention = parseFloat(form.request_retention.replace(',', '.'));
    const fsrs_params = {
      ...(deck?.fsrs_params ?? {}),
      schema_mode: form.schema_mode,
      ...(Number.isFinite(retention) && retention >= 0.7 && retention <= 0.98 ? { request_retention: retention } : { request_retention: undefined }),
    };
    if (fsrs_params.request_retention === undefined) delete fsrs_params.request_retention;

    const ts = nowIso();
    const siblings = decks.filter((d) => d.deleted_at === null && (d.parent_id ?? NO_PARENT) === form.parent_id && d.id !== deck?.id);
    const row: Deck = {
      id: deck?.id ?? newId(),
      user_id: userId,
      parent_id: form.parent_id === NO_PARENT ? null : form.parent_id,
      name,
      description: form.description.trim() || null,
      color: form.color,
      icon: deck?.icon ?? null,
      position: deck?.position ?? siblings.length,
      fsrs_params,
      daily_new_limit: intOr(form.daily_new_limit, 20, 0, 999),
      daily_review_limit: intOr(form.daily_review_limit, 200, 0, 9999),
      created_at: deck?.created_at ?? ts,
      updated_at: ts,
      deleted_at: null,
    };
    const saved = await putDeck(row);
    setSaving(false);
    toast.success(deck ? 'deck gespeichert' : `"${saved.name}" angelegt`);
    onSaved?.(saved);
    onOpenChange(false);
  }

  async function handleDelete() {
    if (!deck) return;
    setSaving(true);
    await softDeleteDeck(deck.id);
    setSaving(false);
    toast.success(`"${deck.name}" gelöscht`);
    onOpenChange(false);
    onDeleted?.();
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">name</Label>
        <Input value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">beschreibung</Label>
        <Textarea rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">übergeordnetes deck</Label>
        <Select value={form.parent_id} onValueChange={(v) => set('parent_id', v)}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_PARENT}>keins</SelectItem>
            {parents.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">farbe</Label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-label="keine farbe"
            onClick={() => set('color', null)}
            className={cn('h-8 w-8 rounded-full border-2', form.color === null ? 'border-foreground' : 'border-border')}
          />
          {CARDS_ACCENT_PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              onClick={() => set('color', c)}
              style={{ backgroundColor: c }}
              className={cn('h-8 w-8 rounded-full border-2', form.color === c ? 'border-foreground' : 'border-transparent')}
            />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">neue karten / tag</Label>
          <Input inputMode="numeric" className="font-mono" value={form.daily_new_limit} onChange={(e) => set('daily_new_limit', e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">reviews / tag</Label>
          <Input inputMode="numeric" className="font-mono" value={form.daily_review_limit} onChange={(e) => set('daily_review_limit', e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">schema abfragen</Label>
          <Select value={form.schema_mode} onValueChange={(v) => set('schema_mode', v as SchemaMode)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="whole">als ganzes</SelectItem>
              <SelectItem value="steps">schritt für schritt</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">retention (leer = global)</Label>
          <Input inputMode="decimal" className="font-mono" placeholder="0.9" value={form.request_retention} onChange={(e) => set('request_retention', e.target.value)} />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-2">
        {deck ? (
          confirmDelete ? (
            <Button type="button" variant="destructive" size="sm" disabled={saving} onClick={handleDelete}>
              wirklich löschen (inkl. karten)
            </Button>
          ) : (
            <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setConfirmDelete(true)}>
              löschen
            </Button>
          )
        ) : <span />}
        <Button type="button" onClick={handleSave} disabled={saving || !form.name.trim()}>
          speichern
        </Button>
      </div>
    </div>
  );
}
