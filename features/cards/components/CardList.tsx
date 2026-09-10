'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { CardRow } from '../hooks/useCards';
import { CARDS_ROUTES } from '../routes';

const ROW_HEIGHT = 64;
const OVERSCAN = 6;

/**
 * Window-scrolled virtual list with fixed row height — no dependency, good
 * enough for a few thousand rows on a phone. Rows must not grow past ROW_HEIGHT.
 */
function useWindowRange(count: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState({ start: 0, end: Math.min(count, 30) });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const top = el.getBoundingClientRect().top;
      const viewport = window.innerHeight;
      const first = Math.max(0, Math.floor(-top / ROW_HEIGHT) - OVERSCAN);
      const visible = Math.ceil(viewport / ROW_HEIGHT) + OVERSCAN * 2;
      setRange({ start: Math.min(first, Math.max(0, count - 1)), end: Math.min(count, first + visible) });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [count]);

  return { ref, ...range };
}

function Status({ row }: { row: CardRow }) {
  const items: { label: string; cls: string }[] = [];
  if (row.suspended) items.push({ label: 'ausgesetzt', cls: 'text-muted-foreground/70' });
  else {
    if (row.due) items.push({ label: 'fällig', cls: 'text-[var(--cards-accent)]' });
    if (row.isNew) items.push({ label: 'neu', cls: 'text-foreground/80' });
  }
  if (row.leech) items.push({ label: 'leech', cls: 'text-amber-400/90' });
  if (items.length === 0) items.push({ label: 'geplant', cls: 'text-muted-foreground/60' });
  return (
    <span className="flex shrink-0 gap-2 font-mono text-[10px]">
      {items.map((i) => (
        <span key={i.label} className={i.cls}>{i.label}</span>
      ))}
    </span>
  );
}

export function CardList({ rows, emptyText }: { rows: CardRow[]; emptyText: string }) {
  const { ref, start, end } = useWindowRange(rows.length);

  if (rows.length === 0) {
    return <p className="py-6 text-center text-xs text-muted-foreground">{emptyText}</p>;
  }

  return (
    <div ref={ref} style={{ height: rows.length * ROW_HEIGHT }} className="relative">
      <div style={{ transform: `translateY(${start * ROW_HEIGHT}px)` }}>
        {rows.slice(start, end).map((row) => (
          <Link
            key={row.card.id}
            href={CARDS_ROUTES.card(row.card.id)}
            style={{ height: ROW_HEIGHT }}
            className={cn(
              'flex items-center gap-3 border-b border-border/60 px-1',
              row.suspended && 'opacity-60'
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{row.title || '(leer)'}</p>
              <p className="mt-0.5 flex items-center gap-2 truncate text-[11px] text-muted-foreground">
                <span className="font-mono">{row.card.type}</span>
                {row.card.tags.length > 0 && <span className="truncate">{row.card.tags.join(' · ')}</span>}
              </p>
            </div>
            <Status row={row} />
          </Link>
        ))}
      </div>
    </div>
  );
}
