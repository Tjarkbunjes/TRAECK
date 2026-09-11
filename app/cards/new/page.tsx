'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { CardsScreen } from '@/features/cards/components/CardsScreen';
import { CardEditor, cardFromDraft, emptyDraft, validateDraft, type CardDraft } from '@/features/cards/components/CardEditor';
import { useDecks } from '@/features/cards/hooks/useDecks';
import { useDeckCardTitles } from '@/features/cards/hooks/useCards';
import { newId, nowIso, saveCard } from '@/features/cards/repo';
import { CARDS_ROUTES } from '@/features/cards/routes';

export default function CardsNewPage() {
  return (
    <Suspense fallback={null}>
      <NewCardContent />
    </Suspense>
  );
}

function NewCardContent() {
  const router = useRouter();
  const deckParam = useSearchParams().get('deck') ?? '';
  const { decks, liveDecks, loading, userId } = useDecks();
  const [stored, setStored] = useState<CardDraft>(() => emptyDraft(deckParam));
  const [saving, setSaving] = useState(false);

  // no deck passed → fall back to the first deck once decks are loaded (derived, no effect)
  const draft = stored.deck_id || liveDecks.length === 0 ? stored : { ...stored, deck_id: liveDecks[0].id };
  const existing = useDeckCardTitles(draft.deck_id || null);
  const deck = liveDecks.find((d) => d.id === draft.deck_id) ?? null;
  const error = validateDraft(draft);

  async function save(andAnother: boolean) {
    if (!userId || error) return;
    setSaving(true);
    const ts = nowIso();
    const card = cardFromDraft(draft, { id: newId(), user_id: userId, created_at: ts });
    await saveCard(card, deck?.fsrs_params?.schema_mode ?? 'whole');
    setSaving(false);
    toast.success('karte gespeichert');
    if (andAnother) {
      setStored({ ...emptyDraft(draft.deck_id, draft.type), tags: draft.tags });
      window.scrollTo({ top: 0 });
    } else {
      router.push(CARDS_ROUTES.deck(draft.deck_id));
    }
  }

  return (
    <CardsScreen title="neue karte" back={draft.deck_id ? CARDS_ROUTES.deck(draft.deck_id) : CARDS_ROUTES.decks}>
      {!loading && liveDecks.length === 0 ? (
        <p className="text-sm text-muted-foreground">erst ein deck anlegen.</p>
      ) : userId ? (
        <>
          <CardEditor
            draft={draft}
            onChange={setStored}
            decks={decks}
            existingTitles={existing}
            userId={userId}
            schemaMode={deck?.fsrs_params?.schema_mode ?? 'whole'}
          />
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" disabled={saving || !!error} onClick={() => save(true)}>
              speichern & weitere
            </Button>
            <Button className="flex-1" disabled={saving || !!error} onClick={() => save(false)}>
              speichern
            </Button>
          </div>
        </>
      ) : null}
    </CardsScreen>
  );
}
