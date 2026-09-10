'use client';

import { CardsScreen } from '@/features/cards/components/CardsScreen';
import { CARDS_ROUTES } from '@/features/cards/routes';
import { CARD_TYPES } from '@/features/cards/types';

export default function CardsNewPage() {
  return (
    <CardsScreen title="neue karte" back={CARDS_ROUTES.dashboard}>
      <div className="flex flex-wrap gap-2">
        {CARD_TYPES.map((t) => (
          <span key={t} className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">
            {t}
          </span>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">typwahl und markdown-editor kommen in phase 2.</p>
    </CardsScreen>
  );
}
