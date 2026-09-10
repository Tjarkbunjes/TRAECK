'use client';

import { CardsScreen } from '@/features/cards/components/CardsScreen';
import { CARDS_ROUTES } from '@/features/cards/routes';

export default function CardsStatsPage() {
  return (
    <CardsScreen title="statistik" back={CARDS_ROUTES.dashboard}>
      <p className="text-xs text-muted-foreground">retention, reviews/tag und stabilitätsverteilung kommen in phase 6.</p>
    </CardsScreen>
  );
}
