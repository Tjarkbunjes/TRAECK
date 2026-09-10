'use client';

import { CardsScreen } from '@/features/cards/components/CardsScreen';
import { CARDS_ROUTES } from '@/features/cards/routes';

export default function CardsLearnPage() {
  return (
    <CardsScreen title="lernen" back={CARDS_ROUTES.dashboard} fullBleed>
      <div className="mx-auto max-w-md flex flex-col items-center justify-center min-h-[50vh] gap-2 text-center">
        <p className="text-muted-foreground">nichts fällig.</p>
        <p className="text-xs text-muted-foreground">lernmodus kommt in phase 3.</p>
      </div>
    </CardsScreen>
  );
}
