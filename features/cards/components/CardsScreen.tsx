'use client';

import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { useCardsSettings } from '../useCardsSettings';
import { useCardsSync } from '../sync/useCardsSync';
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
