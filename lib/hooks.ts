'use client';

import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import type { Profile, FoodEntry, WeightEntry, Workout, WorkoutSet } from './types';
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

export function useAuth() {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user ? { id: user.id, email: user.email } : null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? { id: session.user.id, email: session.user.email } : null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { user, loading };
}
