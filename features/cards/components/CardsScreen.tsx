'use client';

import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { useCardsSettings } from '../useCardsSettings';
import { useCardsSync } from '../sync/useCardsSync';
import { CARDS_ROUTES } from '../routes';
import { SyncBadge } from './SyncBadge';

interface CardsScreenProps {
  title: string;
  /** where the back arrow goes; omit on the dashboard */
  back?: string;
  /** right-aligned header slot */
  action?: ReactNode;
  /** full-bleed screens (learn mode) skip the max-w-md container */
  fullBleed?: boolean;
  children: ReactNode;
}

/**
 * Shell for every /cards screen: auth gate, header, sync state and the
 * module accent as a CSS variable (`--cards-accent`) so nothing outside the
 * module is affected by the user's color choice.
 */
export function CardsScreen({ title, back, action, fullBleed = false, children }: CardsScreenProps) {
  const { user, loading } = useAuth();
  const { settings } = useCardsSettings();
  const sync = useCardsSync();

  const style = { '--cards-accent': settings.theme.accent } as CSSProperties;

  if (loading) {
    return (
      <div className="mx-auto max-w-md p-4 flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">loading…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md p-4 flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">please sign in to view cards.</p>
      </div>
    );
  }

  return (
    <div style={style} className={cn('mx-auto p-4 pb-24 space-y-4', !fullBleed && 'max-w-md')}>
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {back && (
            <Link
              href={back}
              aria-label="back"
              className="flex h-11 w-11 -ml-3 items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-5 w-5" strokeWidth={1.5} />
            </Link>
          )}
          <h1 className="text-2xl font-bold truncate">{title}</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <SyncBadge state={sync} />
          {action}
        </div>
      </header>
      {children}
    </div>
  );
}

/** Small link row used by the placeholder screens to keep the skeleton navigable. */
export function CardsQuickLinks({ current }: { current: string }) {
  const links: Array<{ href: string; label: string }> = [
    { href: CARDS_ROUTES.dashboard, label: 'dashboard' },
    { href: CARDS_ROUTES.learn, label: 'lernen' },
    { href: CARDS_ROUTES.decks, label: 'decks' },
    { href: CARDS_ROUTES.newCard, label: 'neue karte' },
    { href: CARDS_ROUTES.stats, label: 'statistik' },
    { href: CARDS_ROUTES.settings, label: 'einstellungen' },
    { href: CARDS_ROUTES.import, label: 'import' },
  ];
  return (
    <nav className="flex flex-wrap gap-2">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={cn(
            'rounded-md border px-3 py-2 text-xs transition-colors min-h-[44px] flex items-center',
            l.href === current
              ? 'border-[var(--cards-accent)] text-[var(--cards-accent)]'
              : 'border-border text-muted-foreground hover:text-foreground'
          )}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
