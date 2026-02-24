-- Garmin health data table
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS garmin_health_data (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date date NOT NULL,

  -- Steps
  steps integer,
  step_goal integer,

  -- Heart rate
  resting_hr integer,
  avg_hr integer,
  max_hr integer,

  -- Sleep
  sleep_score integer,       -- 0–100
  sleep_seconds integer,     -- total sleep in seconds

  -- Body battery
  body_battery_high integer, -- highest body battery of the day

  -- Stress
  stress_avg integer,        -- avg stress level 0–100

  -- Activity summary
  calories_active integer,
  distance_meters integer,

  fetched_at timestamptz DEFAULT now(),

  UNIQUE(user_id, date)
);

-- RLS: users can only see their own data
ALTER TABLE garmin_health_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own garmin data"
  ON garmin_health_data FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert garmin data"
  ON garmin_health_data FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update garmin data"
  ON garmin_health_data FOR UPDATE
  USING (true);
