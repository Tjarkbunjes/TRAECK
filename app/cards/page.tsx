'use client';

import Link from 'next/link';
import { Play } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CardsScreen, CardsQuickLinks } from '@/features/cards/components/CardsScreen';
import { CARDS_ROUTES } from '@/features/cards/routes';
import { useCardsSettings } from '@/features/cards/useCardsSettings';

const WIDGET_LABELS = {
  queue: 'tagesqueue',
  streak: 'streak',
  heatmap: 'heatmap',
  retention: 'retention',
  decks: 'decks',
} as const;

export default function CardsDashboardPage() {
  const { settings } = useCardsSettings();

  return (
    <CardsScreen title="karten">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">heute</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-4xl">0</span>
            <span className="text-sm text-muted-foreground">fällig · ca. 0 min</span>
          </div>
          <Link
            href={CARDS_ROUTES.learn}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[var(--cards-accent)] text-sm font-medium text-black transition-opacity hover:opacity-90"
          >
            <Play className="h-4 w-4" strokeWidth={1.5} />
            lernen
          </Link>
        </CardContent>
      </Card>

      {settings.dashboard.widgets
        .filter((w) => w !== 'queue')
        .map((w) => (
          <Card key={w}>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">{WIDGET_LABELS[w]}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">kommt in phase {w === 'decks' ? 2 : 6}.</p>
            </CardContent>
          </Card>
        ))}

      <CardsQuickLinks current={CARDS_ROUTES.dashboard} />
    </CardsScreen>
  );
}
