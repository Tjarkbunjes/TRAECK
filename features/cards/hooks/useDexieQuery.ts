'use client';

import { useEffect, useState, type DependencyList } from 'react';
import { onCardsChanged } from '../sync/syncWorker';

interface DexieQueryResult<T> {
  data: T | undefined;
  loading: boolean;
  refresh: () => void;
}

/**
 * Run a Dexie read and re-run it whenever the cards mirror changes (local
 * write or sync pull). `query` should only depend on values listed in `deps`.
 */
export function useDexieQuery<T>(query: () => Promise<T>, deps: DependencyList): DexieQueryResult<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    query().then((result) => {
      if (cancelled) return;
      setData(result);
      setLoading(false);
    });
    const unsubscribe = onCardsChanged(() => {
      query().then((result) => {
        if (!cancelled) setData(result);
      });
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  return { data, loading, refresh: () => setTick((t) => t + 1) };
}
