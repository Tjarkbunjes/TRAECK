'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  DEFAULT_CARDS_SETTINGS,
  cardsSettingsFromProfileSettings,
  resolveCardsSettings,
  withCardsSettings,
  type CardsSettings,
} from './settings';

const CACHE_KEY = 'traeck.cards.settings';

function readCache(): CardsSettings | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? resolveCardsSettings(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function writeCache(settings: CardsSettings): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(settings));
  } catch {
    // storage unavailable (private mode etc.) — settings still work for this session
  }
}

/**
 * Cards settings from profiles.settings.cards, cached in localStorage so the
 * module renders with the user's preferences even before Supabase answers.
 * `save` writes only the `cards` subtree back and never touches other keys.
 */
export function useCardsSettings() {
  const [settings, setSettings] = useState<CardsSettings>(() => readCache() ?? DEFAULT_CARDS_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data } = await supabase.from('profiles').select('settings').eq('id', user.id).single();
      if (cancelled) return;
      if (data) {
        const resolved = cardsSettingsFromProfileSettings(data.settings);
        setSettings(resolved);
        writeCache(resolved);
      }
      setLoading(false);
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  const save = useCallback(async (next: CardsSettings): Promise<{ error: string | null }> => {
    setSettings(next);
    writeCache(next);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'not signed in' };

    // re-read so we merge into the latest settings object, not a stale one
    const { data: current } = await supabase.from('profiles').select('settings').eq('id', user.id).single();
    const { error } = await supabase
      .from('profiles')
      .update({ settings: withCardsSettings(current?.settings, next) })
      .eq('id', user.id);
    return { error: error?.message ?? null };
  }, []);

  return { settings, loading, save };
}
