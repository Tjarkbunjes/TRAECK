'use client';

import { Cloud, CloudOff, Loader2, TriangleAlert } from 'lucide-react';
import type { SyncState } from '../sync/syncWorker';

/** Quiet one-glance sync indicator for the screen header. */
export function SyncBadge({ state }: { state: SyncState }) {
  const base = 'flex items-center gap-1 text-[11px] text-muted-foreground';

  if (state.status === 'syncing') {
    return (
      <span className={base} title="syncing">
        <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
      </span>
    );
  }
  if (state.status === 'offline') {
    return (
      <span className={base} title="offline — changes are queued">
        <CloudOff className="h-3.5 w-3.5" strokeWidth={1.5} />
        {state.pending > 0 && <span className="font-mono">{state.pending}</span>}
      </span>
    );
  }
  if (state.status === 'error') {
    return (
      <span className={base} title={state.error ?? 'sync error'}>
        <TriangleAlert className="h-3.5 w-3.5" strokeWidth={1.5} />
        {state.pending > 0 && <span className="font-mono">{state.pending}</span>}
      </span>
    );
  }
  return (
    <span className={base} title={state.lastSyncedAt ? `synced ${state.lastSyncedAt}` : 'synced'}>
      <Cloud className="h-3.5 w-3.5" strokeWidth={1.5} />
      {state.pending > 0 && <span className="font-mono">{state.pending}</span>}
    </span>
  );
}
