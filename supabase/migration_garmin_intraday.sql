-- Add intraday heart rate values column
-- Run this in your Supabase SQL editor

ALTER TABLE garmin_health_data
  ADD COLUMN IF NOT EXISTS hr_values jsonb;
