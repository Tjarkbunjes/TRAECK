'use client';

import Link from 'next/link';
import { Play, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CardsScreen, CardsQuickLinks } from '@/features/cards/components/CardsScreen';
import { DeckTree, DeckTreeLegend } from '@/features/cards/components/DeckTree';
import { useDecks } from '@/features/cards/hooks/useDecks';
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
  const { tree, countsWithChildren } = useDecks();

  const totals = tree.reduce(
    (acc, n) => {
      const c = countsWithChildren.get(n.deck.id);
      return { due: acc.due + (c?.due ?? 0), new: acc.new + (c?.new ?? 0) };
    },
    { due: 0, new: 0 }
  );

  return (
    <CardsScreen title="karten">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">heute</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-4xl tabular-nums">{totals.due}</span>
            <span className="text-sm text-muted-foreground">fällig · <span className="font-mono">{totals.new}</span> neu</span>
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
        .map((w) =>
          w === 'decks' ? (
            <Card key={w}>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">decks</CardTitle>
                <Link href={CARDS_ROUTES.decks} className="text-xs text-muted-foreground hover:text-foreground">alle</Link>
              </CardHeader>
              <CardContent className="space-y-2">
                {tree.length === 0 ? (
                  <Link href={CARDS_ROUTES.decks} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
                    <Plus className="h-3.5 w-3.5" strokeWidth={1.5} /> erstes deck anlegen
                  </Link>
                ) : (
                  <>
                    <DeckTreeLegend />
                    <DeckTree nodes={tree.map((n) => ({ ...n, children: [] }))} counts={countsWithChildren} compact />
                  </>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card key={w}>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">{WIDGET_LABELS[w]}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">kommt in phase 6.</p>
              </CardContent>
            </Card>
          )
        )}

      <CardsQuickLinks current={CARDS_ROUTES.dashboard} />
    </CardsScreen>
  );
}
