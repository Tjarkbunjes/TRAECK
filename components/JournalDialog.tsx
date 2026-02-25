'use client';

import { useState, useEffect } from 'react';
import { format, addDays, subDays, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { JournalEntry } from '@/lib/types';

interface Props {
  open: boolean;
  onClose: () => void;
  initialDate: string;
}

export function JournalDialog({ open, onClose, initialDate }: Props) {
  const [date, setDate] = useState(initialDate);
  const [draft, setDraft] = useState<Partial<JournalEntry>>({});
  const [saving, setSaving] = useState(false);
  const today = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    if (open) setDate(initialDate);
  }, [open, initialDate]);

  useEffect(() => {
    if (!open) return;
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', date)
        .maybeSingle();
      setDraft(data ?? {});
    }
    load();
  }, [date, open]);

  function set<K extends keyof JournalEntry>(key: K, value: JournalEntry[K] | null) {
    setDraft(prev => ({ ...prev, [key]: value }));
  }

  async function save() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('journal_entries').upsert(
        { user_id: user.id, date, ...draft },
        { onConflict: 'user_id,date' }
      );
    }
    setSaving(false);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <Button
              variant="ghost" size="icon" className="h-7 w-7"
              onClick={() => setDate(d => format(subDays(parseISO(d), 1), 'yyyy-MM-dd'))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <DialogTitle className="text-sm font-medium">
              {format(parseISO(date), 'EEE, MMM d')}
            </DialogTitle>
            <Button
              variant="ghost" size="icon" className="h-7 w-7"
              onClick={() => setDate(d => format(addDays(parseISO(d), 1), 'yyyy-MM-dd'))}
              disabled={date >= today}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-0 py-1">
          <SectionLabel text="sleep" />

          <Row label="Hours Slept">
            <div className="flex items-center gap-1.5">
              <input
                type="number" min="0" max="24" step="0.5"
                value={draft.hours_slept ?? ''}
                onChange={e => set('hours_slept', e.target.value ? parseFloat(e.target.value) : null)}
                className="w-14 bg-[#1E1E1E] border border-[#292929] rounded-md px-2 py-1 text-sm font-mono text-center focus:outline-none focus:border-[#444]"
                placeholder="–"
              />
              <span className="text-xs text-muted-foreground">hrs</span>
            </div>
          </Row>

          <Row label="Sleep Quality">
            <Scale value={draft.sleep_quality ?? null} onChange={v => set('sleep_quality', v)} max={5} />
          </Row>

          <Row label="Slept with Partner">
            <YesNo value={draft.slept_with_partner ?? null} onChange={v => set('slept_with_partner', v)} />
          </Row>

          <SectionLabel text="subjective" />

          <Row label="Mood">
            <Scale value={draft.mood ?? null} onChange={v => set('mood', v)} max={5} />
          </Row>

          <Row label="Energy Level">
            <Scale value={draft.energy_level ?? null} onChange={v => set('energy_level', v)} max={5} />
          </Row>

          <Row label="Stress Level">
            <Scale value={draft.stress_level ?? null} onChange={v => set('stress_level', v)} max={5} />
          </Row>

          <SectionLabel text="substances" />

          <Row label="Caffeine">
            <YesNo
              value={draft.caffeine ?? null}
              onChange={v => { set('caffeine', v); if (!v) set('caffeine_amount', null); }}
            />
          </Row>

          {draft.caffeine && (
            <Row label="Caffeine Amount">
              <Scale value={draft.caffeine_amount ?? null} onChange={v => set('caffeine_amount', v)} max={5} />
            </Row>
          )}

          <Row label="Alcohol">
            <YesNo
              value={draft.alcohol ?? null}
              onChange={v => { set('alcohol', v); if (!v) set('alcohol_amount', null); }}
            />
          </Row>

          {draft.alcohol && (
            <Row label="Alcohol Amount">
              <Scale value={draft.alcohol_amount ?? null} onChange={v => set('alcohol_amount', v)} max={5} />
            </Row>
          )}

          <SectionLabel text="behaviors" />

          <Row label="Screen Before Bed">
            <YesNo value={draft.screen_before_bed ?? null} onChange={v => set('screen_before_bed', v)} />
          </Row>

          <Row label="Last Meal">
            <input
              type="time"
              value={draft.last_meal_time ?? ''}
              onChange={e => set('last_meal_time', e.target.value || null)}
              className="bg-[#1E1E1E] border border-[#292929] rounded-md px-2 py-1 text-sm font-mono focus:outline-none focus:border-[#444]"
            />
          </Row>

          <Row label="Hydration">
            <Scale value={draft.hydration ?? null} onChange={v => set('hydration', v)} max={3} />
          </Row>

          <SectionLabel text="other" />

          <Row label="Sweets">
            <YesNo value={draft.sweets ?? null} onChange={v => set('sweets', v)} />
          </Row>

          <Row label="Sex">
            <YesNo value={draft.sex ?? null} onChange={v => set('sex', v)} />
          </Row>

          <Row label="Magnesium / Zinc">
            <YesNo value={draft.magnesium_zinc ?? null} onChange={v => set('magnesium_zinc', v)} />
          </Row>
        </div>

        <Button className="w-full mt-2" onClick={save} disabled={saving}>
          {saving ? 'saving...' : 'save'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function SectionLabel({ text }: { text: string }) {
  return (
    <p className="text-[10px] uppercase tracking-wider text-muted-foreground pt-3 pb-1">{text}</p>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-[#1E1E1E] last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function YesNo({ value, onChange }: { value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <div className="flex gap-1">
      {([true, false] as const).map(v => (
        <button
          key={String(v)}
          onClick={() => onChange(v)}
          className={`px-3 py-1 text-xs rounded-md transition-colors ${
            value === v
              ? v ? 'bg-[#2626FF] text-white' : 'bg-[#292929] text-white'
              : 'bg-[#1E1E1E] text-muted-foreground hover:text-foreground'
          }`}
        >
          {v ? 'Yes' : 'No'}
        </button>
      ))}
    </div>
  );
}

function Scale({ value, onChange, max }: { value: number | null; onChange: (v: number) => void; max: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: max }, (_, i) => i + 1).map(n => (
        <button
          key={n}
          onClick={() => onChange(n)}
          className={`w-7 h-7 text-xs rounded-md transition-colors ${
            value === n ? 'bg-[#2626FF] text-white' : 'bg-[#1E1E1E] text-muted-foreground hover:text-foreground'
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}
