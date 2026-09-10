'use client';

import { CardsScreen } from '@/features/cards/components/CardsScreen';
import { CARDS_ROUTES } from '@/features/cards/routes';

export default function CardsImportPage() {
  return (
    <CardsScreen title="import" back={CARDS_ROUTES.dashboard}>
      <p className="text-xs text-muted-foreground">import aus datei oder content/decks/ kommt in phase 5.</p>
    </CardsScreen>
  );
}
