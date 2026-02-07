'use client';

import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import type { Profile, FoodEntry, WeightEntry, Workout, WorkoutSet, Friendship, DailyFoodAggregate } from './types';
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

export function useAnalyticsWorkouts(days: number) {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [sets, setSets] = useState<WorkoutSet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data } = await supabase
        .from('workouts')
        .select('*, workout_sets(*)')
        .eq('user_id', user.id)
        .gte('date', format(startDate, 'yyyy-MM-dd'))
        .order('date', { ascending: true });

      if (data) {
        const allSets: WorkoutSet[] = [];
        const ws: Workout[] = [];
        for (const row of data) {
          const { workout_sets, ...workout } = row;
          ws.push(workout as Workout);
          if (Array.isArray(workout_sets)) {
            allSets.push(...(workout_sets as WorkoutSet[]));
          }
        }
        setWorkouts(ws);
        setSets(allSets);
      } else {
        setWorkouts([]);
        setSets([]);
      }
      setLoading(false);
    }
    load();
  }, [days]);

  return { workouts, sets, loading };
}

export function useAnalyticsFood(days: number) {
  const [dailyFood, setDailyFood] = useState<DailyFoodAggregate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data } = await supabase
        .from('food_entries')
        .select('date, calories, protein, carbs, fat')
        .eq('user_id', user.id)
        .gte('date', format(startDate, 'yyyy-MM-dd'))
        .order('date', { ascending: true });

      if (data) {
        const map = new Map<string, DailyFoodAggregate>();
        for (const entry of data) {
          const existing = map.get(entry.date);
          if (existing) {
            existing.calories += entry.calories || 0;
            existing.protein += entry.protein || 0;
            existing.carbs += entry.carbs || 0;
            existing.fat += entry.fat || 0;
          } else {
            map.set(entry.date, {
              date: entry.date,
              calories: entry.calories || 0,
              protein: entry.protein || 0,
              carbs: entry.carbs || 0,
              fat: entry.fat || 0,
            });
          }
        }
        setDailyFood(Array.from(map.values()));
      } else {
        setDailyFood([]);
      }
      setLoading(false);
    }
    load();
  }, [days]);

  return { dailyFood, loading };
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
    } else if (u.email && existing.email !== u.email) {
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

    const { data: friendships } = await supabase
      .from('friendships')
      .select('*')
      .eq('status', 'accepted')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

    if (!friendships || friendships.length === 0) {
      setFriends([]);
      setLoading(false);
      return;
    }

    // Get the friend's user ID (the other person)
    const friendIds = friendships.map(f =>
      f.requester_id === user.id ? f.addressee_id : f.requester_id
    );

    const { data: profiles } = await supabase
      .rpc('get_profiles_with_email', { p_user_ids: friendIds });

    const profileMap = new Map((profiles || []).map((p: { id: string; display_name: string | null; email: string | null }) => [p.id, p]));

    const result: Friendship[] = friendships.map(f => {
      const isRequester = f.requester_id === user.id;
      const friendId = isRequester ? f.addressee_id : f.requester_id;
      // Each user has their own nickname for the friend
      const nickname = isRequester ? f.requester_nickname : f.addressee_nickname;
      return {
        ...f,
        nickname,
        friend_profile: profileMap.get(friendId) || { id: friendId, display_name: null, email: null },
      };
    });

    setFriends(result);
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

    const { data: pending } = await supabase
      .from('friendships')
      .select('*')
      .eq('addressee_id', user.id)
      .eq('status', 'pending');

    if (!pending || pending.length === 0) {
      setRequests([]);
      setLoading(false);
      return;
    }

    const requesterIds = pending.map(f => f.requester_id);

    const { data: profiles } = await supabase
      .rpc('get_profiles_with_email', { p_user_ids: requesterIds });

    const profileMap = new Map((profiles || []).map((p: { id: string; display_name: string | null; email: string | null }) => [p.id, p]));

    const result: Friendship[] = pending.map(f => ({
      ...f,
      friend_profile: profileMap.get(f.requester_id) || { id: f.requester_id, display_name: null, email: null },
    }));

    setRequests(result);
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
      .rpc('get_friend_workouts', { p_friend_id: friendId })
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
      .rpc('get_friend_weight', { p_friend_id: friendId })
      .then(({ data }) => {
        setEntries(data || []);
        setLoading(false);
      });
  }, [friendId]);

  return { entries, loading };
}

export function useFriendCaloriesWeek(friendId: string | null) {
  const [days, setDays] = useState<{ date: string; total_calories: number }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!friendId) { setDays([]); return; }
    setLoading(true);
    supabase
      .rpc('get_friend_calories_week', { p_friend_id: friendId })
      .then(({ data }) => {
        setDays(data || []);
        setLoading(false);
      });
  }, [friendId]);

  return { days, loading };
}
