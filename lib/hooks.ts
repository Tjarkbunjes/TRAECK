'use client';

import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import type { Profile, FoodEntry, WeightEntry, Workout, WorkoutSet, Friendship } from './types';
import { format } from 'date-fns';

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      setProfile(data);
      setLoading(false);
    }
    load();
  }, []);

  return { profile, loading, setProfile };
}

export function useFoodEntries(date: string) {
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data } = await supabase
      .from('food_entries')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', date)
      .order('created_at', { ascending: true });

    setEntries(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [date]);

  return { entries, loading, refresh: load, setEntries };
}

export function useWeightEntries(days: number = 30) {
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data } = await supabase
      .from('weight_entries')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', format(startDate, 'yyyy-MM-dd'))
      .order('date', { ascending: true });

    setEntries(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [days]);

  return { entries, loading, refresh: load };
}

export function useWorkouts() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data } = await supabase
      .from('workouts')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(20);

    setWorkouts(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  return { workouts, loading, refresh: load };
}

export function useLastSets(exerciseName: string) {
  const [sets, setSets] = useState<WorkoutSet[]>([]);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get the most recent workout that has this exercise
      const { data } = await supabase
        .from('workout_sets')
        .select('*, workouts!inner(user_id, date)')
        .eq('workouts.user_id', user.id)
        .eq('exercise_name', exerciseName)
        .order('created_at', { ascending: false })
        .limit(10);

      if (data && data.length > 0) {
        // Get sets from the most recent workout only
        const latestWorkoutId = data[0].workout_id;
        const latestSets = data.filter(s => s.workout_id === latestWorkoutId);
        setSets(latestSets);
      }
    }
    if (exerciseName) load();
  }, [exerciseName]);

  return sets;
}

// Fire-and-forget: create profile on first sign-in after email confirmation
async function ensureProfile(u: { id: string; email?: string; user_metadata?: Record<string, unknown> }) {
  try {
    const { data: existing } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('id', u.id)
      .single();

    if (!existing) {
      const displayName = (u.user_metadata?.display_name as string) || null;
      await supabase.from('profiles').insert({
        id: u.id,
        display_name: displayName,
        email: u.email || null,
        calorie_goal: 2000,
        protein_goal: 150,
        carbs_goal: 250,
        fat_goal: 70,
      });
    } else if (!existing.email && u.email) {
      await supabase.from('profiles').update({ email: u.email }).eq('id', u.id);
    }
  } catch { /* ignore */ }
}

export function useAuth() {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user ? { id: user.id, email: user.email } : null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ? { id: session.user.id, email: session.user.email } : null);

      if (event === 'SIGNED_IN' && session?.user) {
        ensureProfile(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return { user, loading };
}

export function useFriends() {
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    // Get accepted friendships where I'm either requester or addressee
    const { data: asRequester } = await supabase
      .from('friendships')
      .select('*, profiles!friendships_addressee_id_fkey(id, display_name, email)')
      .eq('requester_id', user.id)
      .eq('status', 'accepted');

    const { data: asAddressee } = await supabase
      .from('friendships')
      .select('*, profiles!friendships_requester_id_fkey(id, display_name, email)')
      .eq('addressee_id', user.id)
      .eq('status', 'accepted');

    const all: Friendship[] = [
      ...(asRequester || []).map((f: Record<string, unknown>) => ({
        ...f,
        profiles: f.profiles,
      })) as Friendship[],
      ...(asAddressee || []).map((f: Record<string, unknown>) => ({
        ...f,
        profiles: f.profiles,
      })) as Friendship[],
    ];

    setFriends(all);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  return { friends, loading, refresh: load };
}

export function useFriendRequests() {
  const [requests, setRequests] = useState<Friendship[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data } = await supabase
      .from('friendships')
      .select('*, profiles!friendships_requester_id_fkey(id, display_name, email)')
      .eq('addressee_id', user.id)
      .eq('status', 'pending');

    setRequests((data || []) as Friendship[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  return { requests, loading, refresh: load };
}

export function useFriendWorkouts(friendId: string | null) {
  const [workouts, setWorkouts] = useState<{ id: string; date: string; name: string | null; finished_at: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!friendId) { setWorkouts([]); return; }
    setLoading(true);
    supabase
      .rpc('get_friend_workouts', { p_friend_id: friendId, p_days: 90 })
      .then(({ data }) => {
        setWorkouts(data || []);
        setLoading(false);
      });
  }, [friendId]);

  return { workouts, loading };
}

export function useFriendWeight(friendId: string | null) {
  const [entries, setEntries] = useState<{ date: string; weight_kg: number }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!friendId) { setEntries([]); return; }
    setLoading(true);
    supabase
      .rpc('get_friend_weight', { p_friend_id: friendId, p_days: 90 })
      .then(({ data }) => {
        setEntries(data || []);
        setLoading(false);
      });
  }, [friendId]);

  return { entries, loading };
}
