-- Seed: Insert TRÆCK default templates
-- Run this AFTER migration_admin_templates.sql
-- Replace YOUR_USER_ID with your actual Supabase user ID (uuid from auth.users)
-- You can find it via: SELECT id FROM auth.users WHERE email = 'bunjes.tjark@gmail.com';

DO $$
DECLARE
  admin_id uuid;
BEGIN
  SELECT id INTO admin_id FROM auth.users WHERE email = 'bunjes.tjark@gmail.com';

  IF admin_id IS NULL THEN
    RAISE EXCEPTION 'Admin user not found';
  END IF;

  INSERT INTO workout_templates (user_id, name, exercises, is_default) VALUES
  (
    admin_id,
    'Push Day',
    '[
      {"exercise_name": "Bench Press (Barbell)", "muscle_group": "chest", "default_sets": 3},
      {"exercise_name": "Incline Bench Press (Dumbbell)", "muscle_group": "chest", "default_sets": 3},
      {"exercise_name": "Lateral Raise (Dumbbell)", "muscle_group": "shoulders", "default_sets": 3},
      {"exercise_name": "Tricep Pushdown (Bar)", "muscle_group": "arms", "default_sets": 3},
      {"exercise_name": "Tricep Pushdown (Rope)", "muscle_group": "arms", "default_sets": 3}
    ]'::jsonb,
    true
  ),
  (
    admin_id,
    'Pull Day',
    '[
      {"exercise_name": "Lat Pulldown (Neutral, Close)", "muscle_group": "back", "default_sets": 3},
      {"exercise_name": "Cable Row (Wide)", "muscle_group": "back", "default_sets": 3},
      {"exercise_name": "Bicep Curls (EZ-Bar)", "muscle_group": "arms", "default_sets": 3},
      {"exercise_name": "Bicep Curls (Dumbbell, Seated)", "muscle_group": "arms", "default_sets": 3}
    ]'::jsonb,
    true
  ),
  (
    admin_id,
    'Leg Day',
    '[
      {"exercise_name": "Leg Curl (Seated)", "muscle_group": "legs", "default_sets": 3},
      {"exercise_name": "Leg Press (45°)", "muscle_group": "legs", "default_sets": 3},
      {"exercise_name": "Leg Extension", "muscle_group": "legs", "default_sets": 3},
      {"exercise_name": "Hip Abductor", "muscle_group": "legs", "default_sets": 3},
      {"exercise_name": "Hip Adductor", "muscle_group": "legs", "default_sets": 3}
    ]'::jsonb,
    true
  );
END $$;
