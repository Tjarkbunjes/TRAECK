'use client';

import { useEffect, useState } from 'react';
import { getSyncState, refreshPendingCount, requestSync, subscribeSyncState, type SyncState } from './syncWorker';

/**
 * Keeps the cards mirror in sync while a /cards screen is mounted: syncs on
 * mount, whenever the browser comes back online, and when the tab becomes
 * visible again. Returns the live sync state for status UI.
 */
export function useCardsSync(): SyncState {
  const [state, setState] = useState<SyncState>(getSyncState);

  useEffect(() => {
    const unsubscribe = subscribeSyncState(setState);
    void refreshPendingCount();
    void requestSync();

    const onOnline = () => { void requestSync(); };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void requestSync();
    };
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      unsubscribe();
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return state;
}
