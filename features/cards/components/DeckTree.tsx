'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DeckNode } from '../model/decks';
import type { DeckCounts } from '../hooks/useDecks';
import { CARDS_ROUTES } from '../routes';

interface DeckTreeProps {
  nodes: DeckNode[];
  counts: Map<string, DeckCounts>;
  /** compact rows for the dashboard widget */
  compact?: boolean;
}

function Counts({ c }: { c: DeckCounts | undefined }) {
  if (!c) return null;
  return (
    <span className="flex items-center gap-2 font-mono text-xs tabular-nums">
      <span className={cn(c.due > 0 ? 'text-[var(--cards-accent)]' : 'text-muted-foreground/60')}>{c.due}</span>
      <span className={cn(c.new > 0 ? 'text-foreground/80' : 'text-muted-foreground/60')}>{c.new}</span>
      <span className="text-muted-foreground/60">{c.total}</span>
    </span>
  );
}

export function DeckTree({ nodes, counts, compact = false }: DeckTreeProps) {
  if (nodes.length === 0) return null;
  return (
    <ul className="space-y-1">
      {nodes.map((node) => (
        <li key={node.deck.id}>
          <Link
            href={CARDS_ROUTES.deck(node.deck.id)}
            className={cn(
              'flex items-center gap-2 rounded-lg border border-border bg-card px-3 transition-colors hover:border-[#444]',
              compact ? 'min-h-[40px] py-1.5' : 'min-h-[48px] py-2'
            )}
            style={{ marginLeft: `${node.depth * 12}px` }}
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: node.deck.color ?? 'var(--border)' }}
            />
            <span className="min-w-0 flex-1 truncate text-sm">{node.deck.name}</span>
            <Counts c={counts.get(node.deck.id)} />
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" strokeWidth={1.5} />
          </Link>
          {node.children.length > 0 && (
            <div className="mt-1">
              <DeckTree nodes={node.children} counts={counts} compact={compact} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

export function DeckTreeLegend() {
  return (
    <p className="font-mono text-[10px] text-muted-foreground/70">fällig · neu · gesamt</p>
  );
}
