-- Migration: Add workout_exercises table for persistent exercise blocks
-- This table stores which exercises are in a workout, independent of their sets.
-- Allows workouts to survive app closure and exercises to be reordered.

CREATE TABLE IF NOT EXISTS workout_exercises (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workout_id uuid REFERENCES workouts(id) ON DELETE CASCADE NOT NULL,
  exercise_name text NOT NULL,
  muscle_group text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE workout_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own workout exercises"
  ON workout_exercises FOR ALL
  USING (workout_id IN (SELECT id FROM workouts WHERE user_id = auth.uid()));
