'use client';

import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  CARD_TYPES,
  type BasicFields,
  type Card,
  type CardType,
  type ClozeFields,
  type Deck,
  type SchemaFields,
  type StreitstandFields,
} from '../types';
import { cardTitle, clozeIndices, variantsForCard } from '../model/variants';
import { sortDecks } from '../model/decks';
import { CardFace } from './CardFace';

export const CARD_TYPE_LABELS: Record<CardType, string> = {
  basic: 'basic',
  reverse: 'reverse',
  cloze: 'cloze',
  schema: 'schema',
  streitstand: 'streitstand',
};

/** Everything the editor edits — a card minus the bookkeeping columns. */
export interface CardDraft {
  type: CardType;
  deck_id: string;
  basic: BasicFields;
  cloze: ClozeFields;
  schema: SchemaFields;
  streitstand: StreitstandFields;
  tags: string;
  source: string;
}

export function emptyDraft(deckId: string, type: CardType = 'basic'): CardDraft {
  return {
    type,
    deck_id: deckId,
    basic: { front: '', back: '' },
    cloze: { text: '', extra: '' },
    schema: { title: '', steps: [{ label: '', content: '' }] },
    streitstand: { problem: '', ansichten: [{ name: '', argumente: [] }], rechtsprechung: '', stellungnahme: '' },
    tags: '',
    source: '',
  };
}

export function draftFromCard(card: Card): CardDraft {
  const d = emptyDraft(card.deck_id, card.type);
  switch (card.type) {
    case 'basic':
    case 'reverse':
      d.basic = { ...card.fields };
      break;
    case 'cloze':
      d.cloze = { ...card.fields };
      break;
    case 'schema':
      d.schema = { title: card.fields.title, steps: card.fields.steps.map((s) => ({ ...s })) };
      break;
    case 'streitstand':
      d.streitstand = {
        ...card.fields,
        ansichten: card.fields.ansichten.map((a) => ({ name: a.name, argumente: [...a.argumente] })),
      };
      break;
  }
  d.tags = card.tags.join(', ');
  d.source = card.source ?? '';
  return d;
}

function parseTags(input: string): string[] {
  return [...new Set(input.split(/[,\n]/).map((t) => t.trim().toLowerCase()).filter(Boolean))];
}

/** Turn a draft into a complete card row. `base` supplies id/user_id/created_at for edits. */
export function cardFromDraft(draft: CardDraft, base: Pick<Card, 'id' | 'user_id' | 'created_at'>): Card {
  const common = {
    id: base.id,
    user_id: base.user_id,
    created_at: base.created_at,
    deck_id: draft.deck_id,
    tags: parseTags(draft.tags),
    source: draft.source.trim() || null,
    updated_at: base.created_at,
    deleted_at: null,
  };
  switch (draft.type) {
    case 'basic':
      return { ...common, type: 'basic', fields: trimBasic(draft.basic) };
    case 'reverse':
      return { ...common, type: 'reverse', fields: trimBasic(draft.basic) };
    case 'cloze':
      return { ...common, type: 'cloze', fields: { text: draft.cloze.text.trim(), extra: draft.cloze.extra.trim() } };
    case 'schema':
      return {
        ...common,
        type: 'schema',
        fields: {
          title: draft.schema.title.trim(),
          steps: draft.schema.steps
            .map((s) => ({ label: s.label.trim(), content: s.content.trim() }))
            .filter((s) => s.label || s.content),
        },
      };
    case 'streitstand':
      return {
        ...common,
        type: 'streitstand',
        fields: {
          problem: draft.streitstand.problem.trim(),
          ansichten: draft.streitstand.ansichten
            .map((a) => ({ name: a.name.trim(), argumente: a.argumente.map((x) => x.trim()).filter(Boolean) }))
            .filter((a) => a.name || a.argumente.length),
          rechtsprechung: draft.streitstand.rechtsprechung.trim(),
          stellungnahme: draft.streitstand.stellungnahme.trim(),
        },
      };
  }
}

function trimBasic(f: BasicFields): BasicFields {
  return { front: f.front.trim(), back: f.back.trim() };
}

/** Human-readable reason the draft cannot be saved, or null. */
export function validateDraft(draft: CardDraft): string | null {
  if (!draft.deck_id) return 'deck wählen';
  switch (draft.type) {
    case 'basic':
    case 'reverse':
      if (!draft.basic.front.trim()) return 'vorderseite fehlt';
      if (!draft.basic.back.trim()) return 'rückseite fehlt';
      return null;
    case 'cloze':
      if (!draft.cloze.text.trim()) return 'text fehlt';
      if (clozeIndices(draft.cloze.text).length === 0) return 'mindestens eine lücke {{c1::…}}';
      return null;
    case 'schema':
      if (!draft.schema.title.trim()) return 'titel fehlt';
      if (!draft.schema.steps.some((s) => s.label.trim())) return 'mindestens ein schritt';
      return null;
    case 'streitstand':
      if (!draft.streitstand.problem.trim()) return 'problem fehlt';
      if (!draft.streitstand.ansichten.some((a) => a.name.trim() || a.argumente.some((x) => x.trim()))) return 'mindestens eine ansicht';
      return null;
  }
}

const mono = 'font-mono text-sm';

interface CardEditorProps {
  draft: CardDraft;
  onChange: (next: CardDraft) => void;
  decks: Deck[];
  /** lowercase titles of other cards in the deck, for the duplicate hint */
  existingTitles?: { id: string; key: string }[];
  /** id of the card being edited (excluded from the duplicate check) */
  cardId?: string;
  /** user id only needed to build the preview card */
  userId: string;
  schemaMode?: 'whole' | 'steps';
}

export function CardEditor({ draft, onChange, decks, existingTitles = [], cardId, userId, schemaMode = 'whole' }: CardEditorProps) {
  const [previewVariant, setPreviewVariant] = useState<string | null>(null);
  const set = <K extends keyof CardDraft>(key: K, value: CardDraft[K]) => onChange({ ...draft, [key]: value });

  const previewCard = useMemo(
    () => cardFromDraft(draft, { id: cardId ?? 'preview', user_id: userId, created_at: new Date().toISOString() }),
    [draft, cardId, userId]
  );
  const variants = useMemo(() => variantsForCard(previewCard, schemaMode), [previewCard, schemaMode]);
  const activeVariant = previewVariant && variants.includes(previewVariant) ? previewVariant : variants[0] ?? 'fwd';
  const error = validateDraft(draft);

  const duplicate = useMemo(() => {
    const key = cardTitle(previewCard).toLowerCase();
    if (!key) return null;
    return existingTitles.find((t) => t.id !== cardId && t.key === key) ?? null;
  }, [previewCard, existingTitles, cardId]);

  return (
    <Tabs defaultValue="edit" className="space-y-3">
      <TabsList className="w-full">
        <TabsTrigger value="edit" className="flex-1">bearbeiten</TabsTrigger>
        <TabsTrigger value="preview" className="flex-1">vorschau</TabsTrigger>
      </TabsList>

      <TabsContent value="edit" className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">typ</Label>
            <Select value={draft.type} onValueChange={(v) => set('type', v as CardType)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CARD_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{CARD_TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">deck</Label>
            <Select value={draft.deck_id || undefined} onValueChange={(v) => set('deck_id', v)}>
              <SelectTrigger className="w-full"><SelectValue placeholder="deck wählen" /></SelectTrigger>
              <SelectContent>
                {sortDecks(decks.filter((d) => d.deleted_at === null)).map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {(draft.type === 'basic' || draft.type === 'reverse') && (
          <>
            <Field label="vorderseite" hint="markdown">
              <Textarea rows={3} value={draft.basic.front} onChange={(e) => set('basic', { ...draft.basic, front: e.target.value })} />
            </Field>
            <Field label="rückseite" hint="markdown">
              <Textarea rows={6} value={draft.basic.back} onChange={(e) => set('basic', { ...draft.basic, back: e.target.value })} />
            </Field>
          </>
        )}

        {draft.type === 'cloze' && (
          <>
            <Field label="text" hint={`lücken als {{c1::antwort}} · ${clozeIndices(draft.cloze.text).length} lücke(n)`}>
              <Textarea rows={5} value={draft.cloze.text} onChange={(e) => set('cloze', { ...draft.cloze, text: e.target.value })} />
            </Field>
            <Field label="extra" hint="optional, erscheint unter der antwort">
              <Textarea rows={3} value={draft.cloze.extra} onChange={(e) => set('cloze', { ...draft.cloze, extra: e.target.value })} />
            </Field>
          </>
        )}

        {draft.type === 'schema' && (
          <>
            <Field label="titel">
              <Input value={draft.schema.title} onChange={(e) => set('schema', { ...draft.schema, title: e.target.value })} />
            </Field>
            <Field label="schritte">
              <div className="space-y-2">
                {draft.schema.steps.map((s, i) => (
                  <div key={i} className="rounded-lg border border-border p-2 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className={cn(mono, 'w-6 text-muted-foreground')}>{i + 1}.</span>
                      <Input
                        placeholder="label"
                        value={s.label}
                        onChange={(e) => set('schema', { ...draft.schema, steps: draft.schema.steps.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="schritt entfernen"
                        disabled={draft.schema.steps.length === 1}
                        onClick={() => set('schema', { ...draft.schema, steps: draft.schema.steps.filter((_, j) => j !== i) })}
                      >
                        <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                      </Button>
                    </div>
                    <Textarea
                      rows={2}
                      placeholder="inhalt"
                      value={s.content}
                      onChange={(e) => set('schema', { ...draft.schema, steps: draft.schema.steps.map((x, j) => (j === i ? { ...x, content: e.target.value } : x)) })}
                    />
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => set('schema', { ...draft.schema, steps: [...draft.schema.steps, { label: '', content: '' }] })}>
                  <Plus className="h-4 w-4" strokeWidth={1.5} /> schritt
                </Button>
              </div>
            </Field>
          </>
        )}

        {draft.type === 'streitstand' && (
          <>
            <Field label="problem" hint="markdown">
              <Textarea rows={3} value={draft.streitstand.problem} onChange={(e) => set('streitstand', { ...draft.streitstand, problem: e.target.value })} />
            </Field>
            <Field label="ansichten">
              <div className="space-y-2">
                {draft.streitstand.ansichten.map((a, i) => (
                  <div key={i} className="rounded-lg border border-border p-2 space-y-2">
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="name der ansicht"
                        value={a.name}
                        onChange={(e) => set('streitstand', { ...draft.streitstand, ansichten: draft.streitstand.ansichten.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="ansicht entfernen"
                        disabled={draft.streitstand.ansichten.length === 1}
                        onClick={() => set('streitstand', { ...draft.streitstand, ansichten: draft.streitstand.ansichten.filter((_, j) => j !== i) })}
                      >
                        <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                      </Button>
                    </div>
                    <Textarea
                      rows={3}
                      placeholder="ein argument pro zeile"
                      value={a.argumente.join('\n')}
                      onChange={(e) => set('streitstand', { ...draft.streitstand, ansichten: draft.streitstand.ansichten.map((x, j) => (j === i ? { ...x, argumente: e.target.value.split('\n') } : x)) })}
                    />
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => set('streitstand', { ...draft.streitstand, ansichten: [...draft.streitstand.ansichten, { name: '', argumente: [] }] })}>
                  <Plus className="h-4 w-4" strokeWidth={1.5} /> ansicht
                </Button>
              </div>
            </Field>
            <Field label="rechtsprechung" hint="optional">
              <Textarea rows={3} value={draft.streitstand.rechtsprechung} onChange={(e) => set('streitstand', { ...draft.streitstand, rechtsprechung: e.target.value })} />
            </Field>
            <Field label="stellungnahme" hint="optional">
              <Textarea rows={3} value={draft.streitstand.stellungnahme} onChange={(e) => set('streitstand', { ...draft.streitstand, stellungnahme: e.target.value })} />
            </Field>
          </>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="tags" hint="kommagetrennt: rechtsgebiet, teilgebiet, kartenart">
            <Input value={draft.tags} onChange={(e) => set('tags', e.target.value)} />
          </Field>
          <Field label="quelle" hint="nur wenn sicher bekannt">
            <Input value={draft.source} onChange={(e) => set('source', e.target.value)} />
          </Field>
        </div>

        {duplicate && (
          <p className="text-xs text-amber-400/90">ähnliche karte in diesem deck vorhanden.</p>
        )}
        {error && <p className="text-xs text-muted-foreground">{error}</p>}
      </TabsContent>

      <TabsContent value="preview" className="space-y-3">
        {variants.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {variants.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setPreviewVariant(v)}
                className={cn(
                  'rounded-md border px-3 py-1.5 font-mono text-xs min-h-[36px]',
                  v === activeVariant ? 'border-[var(--cards-accent)] text-[var(--cards-accent)]' : 'border-border text-muted-foreground'
                )}
              >
                {v}
              </button>
            ))}
          </div>
        )}
        <div className="rounded-xl border border-border bg-card p-4">
          {error ? (
            <p className="text-center text-sm text-muted-foreground">{error}</p>
          ) : (
            <CardFace card={previewCard} variant={activeVariant} side="both" />
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        {hint && <span className="text-[10px] text-muted-foreground/70">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
