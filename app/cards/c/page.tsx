'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { CardsScreen } from '@/features/cards/components/CardsScreen';
import { CardEditor, cardFromDraft, draftFromCard, validateDraft, type CardDraft } from '@/features/cards/components/CardEditor';
import { CardFace } from '@/features/cards/components/CardFace';
import { useDecks } from '@/features/cards/hooks/useDecks';
import { useCard, useDeckCardTitles } from '@/features/cards/hooks/useCards';
import { variantsForCard } from '@/features/cards/model/variants';
import { saveCard, setCardSuspended, softDeleteCard } from '@/features/cards/repo';
import { CARDS_ROUTES } from '@/features/cards/routes';
import type { Card as CardModel, CardState, CardStateValue, Rating, Review } from '@/features/cards/types';

const STATE_LABELS: Record<CardStateValue, string> = { 0: 'neu', 1: 'lernen', 2: 'review', 3: 'relearn' };
const RATING_LABELS: Record<Rating, string> = { 1: 'again', 2: 'hard', 3: 'good', 4: 'easy' };

export default function CardsCardPage() {
  return (
    <Suspense fallback={null}>
      <CardContent />
    </Suspense>
  );
}

function CardContent() {
  const id = useSearchParams().get('id');
  const { card, states, reviews, loading } = useCard(id);

  if (!id || (!loading && !card) || (card && card.deleted_at !== null)) {
    return (
      <CardsScreen title="karte" back={CARDS_ROUTES.decks}>
        <p className="text-sm text-muted-foreground">karte nicht gefunden.</p>
      </CardsScreen>
    );
  }

  if (!card) {
    return (
      <CardsScreen title="karte" back={CARDS_ROUTES.decks}>
        <p className="text-xs text-muted-foreground">lade…</p>
      </CardsScreen>
    );
  }

  // keyed by id so navigating between cards remounts the editor with a fresh draft
  return <EditPanel key={card.id} card={card} states={states} reviews={reviews} />;
}

function EditPanel({ card, states, reviews }: { card: CardModel; states: CardState[]; reviews: Review[] }) {
  const router = useRouter();
  const { decks, liveDecks, userId } = useDecks();
  // seeded once on mount; later syncs must not clobber what the user is typing
  const [draft, setDraft] = useState<CardDraft>(() => draftFromCard(card));
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const existing = useDeckCardTitles(draft.deck_id || null);

  const deck = liveDecks.find((d) => d.id === draft.deck_id) ?? null;
  const schemaMode = deck?.fsrs_params?.schema_mode ?? 'whole';
  const error = validateDraft(draft);
  const suspended = states.length > 0 && states.every((s) => s.suspended);

  async function handleSave() {
    if (error) return;
    setSaving(true);
    await saveCard(cardFromDraft(draft, card), schemaMode);
    setSaving(false);
    toast.success('karte gespeichert');
  }

  async function handleDelete() {
    await softDeleteCard(card.id);
    toast.success('karte gelöscht');
    router.push(CARDS_ROUTES.deck(card.deck_id));
  }

  return (
    <CardsScreen
      title="karte"
      back={CARDS_ROUTES.deck(card.deck_id)}
      action={
        confirmDelete ? (
          <Button size="sm" variant="destructive" onClick={handleDelete}>löschen?</Button>
        ) : (
          <Button size="icon-sm" variant="ghost" aria-label="karte löschen" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="h-4 w-4" strokeWidth={1.5} />
          </Button>
        )
      }
    >
      {userId && (
        <Tabs defaultValue="edit" className="space-y-3">
          <TabsList className="w-full">
            <TabsTrigger value="edit" className="flex-1">karte</TabsTrigger>
            <TabsTrigger value="history" className="flex-1">verlauf</TabsTrigger>
          </TabsList>

          <TabsContent value="edit" className="space-y-3">
            <CardEditor
              draft={draft}
              onChange={setDraft}
              decks={decks}
              existingTitles={existing}
              cardId={card.id}
              userId={userId}
              schemaMode={schemaMode}
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={async () => {
                  await setCardSuspended(card.id, !suspended);
                  toast.success(suspended ? 'karte wieder aktiv' : 'karte ausgesetzt');
                }}
              >
                {suspended ? 'wieder aktivieren' : 'aussetzen'}
              </Button>
              <Button className="flex-1" disabled={saving || !!error} onClick={handleSave}>
                speichern
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <section className="space-y-2">
              <h2 className="text-xs text-muted-foreground">varianten</h2>
              <div className="rounded-xl border border-border bg-card divide-y divide-border/60">
                {variantsForCard(card, schemaMode).map((v) => {
                  const s = states.find((x) => x.variant === v);
                  return (
                    <div key={v} className="flex items-center gap-3 px-3 py-2 text-xs">
                      <span className="w-8 font-mono">{v}</span>
                      <span className={cn('w-14', s?.suspended && 'text-muted-foreground/60')}>
                        {s ? (s.suspended ? 'ausgesetzt' : STATE_LABELS[s.state]) : '—'}
                      </span>
                      <span className="flex-1 font-mono text-muted-foreground">
                        {s ? `fällig ${format(new Date(s.due), 'dd.MM.yy')}` : ''}
                      </span>
                      {s && (
                        <span className="font-mono text-muted-foreground">
                          {s.reps}r · {s.lapses}l{s.leech ? ' · leech' : ''}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="space-y-2">
              <h2 className="text-xs text-muted-foreground">vorschau</h2>
              {variantsForCard(card, schemaMode).map((v) => (
                <div key={v} className="rounded-xl border border-border bg-card p-4">
                  <p className="mb-2 font-mono text-[10px] text-muted-foreground">{v}</p>
                  <CardFace card={card} variant={v} side="both" />
                </div>
              ))}
            </section>

            <section className="space-y-2">
              <h2 className="text-xs text-muted-foreground">reviews</h2>
              {reviews.length === 0 ? (
                <p className="text-xs text-muted-foreground">noch keine reviews.</p>
              ) : (
                <div className="rounded-xl border border-border bg-card divide-y divide-border/60">
                  {reviews.map((r) => (
                    <div key={r.id} className="flex items-center gap-3 px-3 py-2 font-mono text-xs">
                      <span className="text-muted-foreground">{format(new Date(r.reviewed_at), 'dd.MM.yy HH:mm')}</span>
                      <span className="w-8">{r.variant}</span>
                      <span className="flex-1">{RATING_LABELS[r.rating]}</span>
                      <span className="text-muted-foreground">{Math.round(r.duration_ms / 1000)}s</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </TabsContent>
        </Tabs>
      )}
    </CardsScreen>
  );
}
