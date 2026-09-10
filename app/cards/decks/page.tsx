'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { CardsScreen } from '@/features/cards/components/CardsScreen';
import { DeckDialog } from '@/features/cards/components/DeckDialog';
import { DeckTree, DeckTreeLegend } from '@/features/cards/components/DeckTree';
import { CardList } from '@/features/cards/components/CardList';
import { useDecks } from '@/features/cards/hooks/useDecks';
import { CARD_FILTERS, CARD_FILTER_LABELS, useDeckCards, type CardFilter } from '@/features/cards/hooks/useCards';
import { deckPath, flattenTree } from '@/features/cards/model/decks';
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
  return id ? <DeckDetail id={id} /> : <DeckOverview />;
}

function DeckOverview() {
  const { decks, tree, countsWithChildren, loading, userId } = useDecks();
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <CardsScreen
      title="decks"
      back={CARDS_ROUTES.dashboard}
      action={
        <Button size="icon-sm" variant="outline" aria-label="neues deck" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" strokeWidth={1.5} />
        </Button>
      }
    >
      {loading ? (
        <p className="text-xs text-muted-foreground">lade…</p>
      ) : tree.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center space-y-3">
          <p className="text-sm text-muted-foreground">noch keine decks.</p>
          <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" strokeWidth={1.5} /> erstes deck anlegen
          </Button>
        </div>
      ) : (
        <>
          <DeckTreeLegend />
          <DeckTree nodes={tree} counts={countsWithChildren} />
        </>
      )}
      {userId && (
        <DeckDialog open={dialogOpen} onOpenChange={setDialogOpen} decks={decks} userId={userId} />
      )}
    </CardsScreen>
  );
}

function DeckDetail({ id }: { id: string }) {
  const router = useRouter();
  const { decks, tree, counts, countsWithChildren, loading, userId } = useDecks();
  const deck = decks.find((d) => d.id === id && d.deleted_at === null) ?? null;
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<CardFilter>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const { rows, total } = useDeckCards(deck ? id : null, query, filter);

  const path = deck ? deckPath(decks, id) : [];
  const parent = path.length > 1 ? path[path.length - 2] : null;
  const node = flattenTree(tree).find((n) => n.deck.id === id);
  const own = counts.get(id);
  const all = countsWithChildren.get(id);

  if (!loading && !deck) {
    return (
      <CardsScreen title="deck" back={CARDS_ROUTES.decks}>
        <p className="text-sm text-muted-foreground">deck nicht gefunden.</p>
      </CardsScreen>
    );
  }

  return (
    <CardsScreen
      title={deck?.name ?? '…'}
      back={parent ? CARDS_ROUTES.deck(parent.id) : CARDS_ROUTES.decks}
      action={
        <Button size="icon-sm" variant="outline" aria-label="deck-einstellungen" onClick={() => setDialogOpen(true)}>
          <Settings2 className="h-4 w-4" strokeWidth={1.5} />
        </Button>
      }
    >
      {path.length > 1 && (
        <p className="truncate text-[11px] text-muted-foreground">
          {path.slice(0, -1).map((d) => d.name).join(' / ')}
        </p>
      )}
      {deck?.description && <p className="text-sm text-muted-foreground">{deck.description}</p>}

      <div className="grid grid-cols-4 gap-2 rounded-xl border border-border bg-card p-3">
        <Stat label="karten" value={all?.total ?? 0} />
        <Stat label="fällig" value={all?.due ?? 0} accent />
        <Stat label="neu" value={all?.new ?? 0} />
        <Stat label="ausgesetzt" value={all?.suspended ?? 0} />
      </div>

      {node && node.children.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs text-muted-foreground">unterdecks</h2>
          <DeckTree nodes={node.children.map((c) => ({ ...c, depth: 0 }))} counts={countsWithChildren} compact />
        </section>
      )}

      <Link
        href={`${CARDS_ROUTES.newCard}?deck=${encodeURIComponent(id)}`}
        className="flex h-11 items-center justify-center gap-2 rounded-lg border border-[var(--cards-accent)] text-sm text-[var(--cards-accent)] transition-colors hover:bg-[var(--cards-accent)]/10"
      >
        <Plus className="h-4 w-4" strokeWidth={1.5} /> neue karte
      </Link>

      <section className="space-y-2">
        <Input placeholder="suchen…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="flex flex-wrap gap-1.5">
          {CARD_FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                'rounded-md border px-2.5 py-1.5 text-xs min-h-[32px]',
                f === filter ? 'border-[var(--cards-accent)] text-[var(--cards-accent)]' : 'border-border text-muted-foreground'
              )}
            >
              {CARD_FILTER_LABELS[f]}
            </button>
          ))}
          <span className="ml-auto self-center font-mono text-[10px] text-muted-foreground">
            {rows.length}/{own?.total ?? total}
          </span>
        </div>
        <CardList
          rows={rows}
          emptyText={total === 0 ? 'noch keine karten in diesem deck.' : 'keine treffer.'}
        />
      </section>

      {userId && deck && (
        <DeckDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          decks={decks}
          userId={userId}
          deck={deck}
          onDeleted={() => router.push(parent ? CARDS_ROUTES.deck(parent.id) : CARDS_ROUTES.decks)}
        />
      )}
    </CardsScreen>
  );
}

function Stat({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="text-center">
      <p className={cn('font-mono text-lg tabular-nums', accent && value > 0 && 'text-[var(--cards-accent)]')}>{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
