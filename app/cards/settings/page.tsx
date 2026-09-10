'use client';

import { CardsScreen } from '@/features/cards/components/CardsScreen';
import { CARDS_ROUTES } from '@/features/cards/routes';
import { useCardsSettings } from '@/features/cards/useCardsSettings';

export default function CardsSettingsPage() {
  const { settings, loading } = useCardsSettings();

  return (
    <CardsScreen title="einstellungen" back={CARDS_ROUTES.dashboard}>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
        <dt className="text-muted-foreground">accent</dt>
        <dd className="font-mono flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: settings.theme.accent }} />
          {settings.theme.accent}
        </dd>
        <dt className="text-muted-foreground">zeitbudget</dt>
        <dd className="font-mono">{settings.session.timeBudgetMin} min</dd>
        <dt className="text-muted-foreground">retention</dt>
        <dd className="font-mono">{settings.scheduler.requestRetention}</dd>
        <dt className="text-muted-foreground">bewertung</dt>
        <dd>{settings.interaction.rating}</dd>
      </dl>
      <p className="text-xs text-muted-foreground">
        {loading ? 'lade…' : 'alle optionen, presets und export kommen in phase 4.'}
      </p>
    </CardsScreen>
  );
}
