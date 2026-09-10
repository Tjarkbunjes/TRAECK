'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CardsScreen, CardsQuickLinks } from '@/features/cards/components/CardsScreen';
import { CARDS_ROUTES } from '@/features/cards/routes';

export default function CardsDecksPage() {
  return (
    <Suspense fallback={null}>
      <DecksContent />
    </Suspense>
  );
}

function DecksContent() {
  const id = useSearchParams().get('id');

  if (id) {
    return (
      <CardsScreen title="deck" back={CARDS_ROUTES.decks}>
        <p className="font-mono text-xs text-muted-foreground break-all">{id}</p>
        <p className="text-xs text-muted-foreground">kartenliste, filter und deck-einstellungen kommen in phase 2.</p>
      </CardsScreen>
    );
  }

  return (
    <CardsScreen title="decks" back={CARDS_ROUTES.dashboard}>
      <p className="text-xs text-muted-foreground">noch keine decks. anlegen kommt in phase 2.</p>
      <CardsQuickLinks current={CARDS_ROUTES.decks} />
    </CardsScreen>
  );
}
