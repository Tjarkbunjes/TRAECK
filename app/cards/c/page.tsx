'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CardsScreen } from '@/features/cards/components/CardsScreen';
import { CARDS_ROUTES } from '@/features/cards/routes';

export default function CardsCardPage() {
  return (
    <Suspense fallback={null}>
      <CardContent />
    </Suspense>
  );
}

function CardContent() {
  const id = useSearchParams().get('id');

  return (
    <CardsScreen title="karte" back={CARDS_ROUTES.decks}>
      {id ? (
        <p className="font-mono text-xs text-muted-foreground break-all">{id}</p>
      ) : (
        <p className="text-xs text-muted-foreground">keine karte gewählt.</p>
      )}
      <p className="text-xs text-muted-foreground">bearbeiten, vorschau und review-historie kommen in phase 2.</p>
    </CardsScreen>
  );
}
