'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { supabase } from './supabase';
import { DEFAULT_MODULES, resolveModules, withModules, type ModulesSettings } from './modules';

const CACHE_KEY = 'traeck.modules';

// One shared store for the whole app: BottomNav and the root page both read
// it, and a change in the settings screen must reach them without a reload.
let current: ModulesSettings | null = null;
let fetched = false;
const listeners = new Set<() => void>();

function readCache(): ModulesSettings {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? resolveModules({ modules: JSON.parse(raw) }) : DEFAULT_MODULES;
  } catch {
    return DEFAULT_MODULES;
  }
}

function publish(next: ModulesSettings) {
  current = next;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(next));
  } catch {
    // storage unavailable — in-memory copy still works for this session
  }
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): ModulesSettings {
  if (current === null) current = readCache();
  return current;
}

function getServerSnapshot(): ModulesSettings {
  return DEFAULT_MODULES;
}

async function fetchModules(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data } = await supabase.from('profiles').select('settings').eq('id', user.id).single();
  if (data) publish(resolveModules(data.settings));
}

/** Forget the cached choice, e.g. on sign-out, so the next user starts from defaults. */
export function clearModulesCache(): void {
  current = null;
  fetched = false;
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // ignore
  }
  for (const l of listeners) l();
}

export function useModules() {
  const modules = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // one fetch per session refreshes the cached choice from profiles.settings
  useEffect(() => {
    if (fetched) return;
    fetched = true;
    void fetchModules();
  }, []);

  const save = useCallback(async (next: ModulesSettings): Promise<{ error: string | null }> => {
    publish(next);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'not signed in' };
    const { data: profile } = await supabase.from('profiles').select('settings').eq('id', user.id).single();
    const { error } = await supabase
      .from('profiles')
      .update({ settings: withModules(profile?.settings, next) })
      .eq('id', user.id);
    return { error: error?.message ?? null };
  }, []);

  return { modules, save };
}
