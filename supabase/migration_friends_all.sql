-- COMPLETE Friends Migration - Run this ONE file in Supabase SQL Editor
-- (replaces v1, v2, v3 - run this even if you already ran v1)

-- 1. Add email column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email text;

-- 2. Create friendships table
CREATE TABLE IF NOT EXISTS friendships (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  addressee_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  status text DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'accepted')),
  nickname text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(requester_id, addressee_id)
);

-- 3. Add nickname column (safe if table was already created without it)
ALTER TABLE friendships ADD COLUMN IF NOT EXISTS nickname text;

-- 4. RLS
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "view_own_friendships" ON friendships;
CREATE POLICY "view_own_friendships" ON friendships
  FOR SELECT USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

DROP POLICY IF EXISTS "create_friend_requests" ON friendships;
CREATE POLICY "create_friend_requests" ON friendships
  FOR INSERT WITH CHECK (auth.uid() = requester_id);

DROP POLICY IF EXISTS "update_addressed_requests" ON friendships;
DROP POLICY IF EXISTS "update_own_friendships" ON friendships;
CREATE POLICY "update_own_friendships" ON friendships
  FOR UPDATE USING (auth.uid() = addressee_id OR auth.uid() = requester_id);

DROP POLICY IF EXISTS "delete_own_friendships" ON friendships;
CREATE POLICY "delete_own_friendships" ON friendships
  FOR DELETE USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- 5. Function: search user by email
CREATE OR REPLACE FUNCTION search_user_by_email(search_email text)
RETURNS TABLE(id uuid, display_name text, email text)
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT p.id, p.display_name, p.email
  FROM profiles p
  WHERE LOWER(p.email) = LOWER(search_email)
    AND p.id != auth.uid();
$$;

-- 6. Function: get friend's workouts (this year)
CREATE OR REPLACE FUNCTION get_friend_workouts(p_friend_id uuid, p_days int DEFAULT 365)
RETURNS TABLE(id uuid, date text, name text, finished_at timestamptz)
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT w.id, w.date::text, w.name, w.finished_at
  FROM workouts w
  WHERE w.user_id = p_friend_id
    AND w.finished_at IS NOT NULL
    AND w.date::date >= make_date(EXTRACT(YEAR FROM now())::int, 1, 1)
    AND EXISTS (
      SELECT 1 FROM friendships f
      WHERE f.status = 'accepted'
        AND (
          (f.requester_id = auth.uid() AND f.addressee_id = p_friend_id)
          OR (f.requester_id = p_friend_id AND f.addressee_id = auth.uid())
        )
    )
  ORDER BY w.date DESC;
$$;

-- 7. Function: get friend's weight entries (this year)
CREATE OR REPLACE FUNCTION get_friend_weight(p_friend_id uuid, p_days int DEFAULT 365)
RETURNS TABLE(date text, weight_kg numeric)
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT we.date::text, we.weight_kg
  FROM weight_entries we
  WHERE we.user_id = p_friend_id
    AND we.date::date >= make_date(EXTRACT(YEAR FROM now())::int, 1, 1)
    AND EXISTS (
      SELECT 1 FROM friendships f
      WHERE f.status = 'accepted'
        AND (
          (f.requester_id = auth.uid() AND f.addressee_id = p_friend_id)
          OR (f.requester_id = p_friend_id AND f.addressee_id = auth.uid())
        )
    )
  ORDER BY we.date ASC;
$$;

-- 8. Function: get friend's calories per day (current week)
CREATE OR REPLACE FUNCTION get_friend_calories_week(p_friend_id uuid)
RETURNS TABLE(date text, total_calories numeric)
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT fe.date::text, SUM(fe.calories) as total_calories
  FROM food_entries fe
  WHERE fe.user_id = p_friend_id
    AND fe.date::date >= date_trunc('week', now()::date)::date
    AND EXISTS (
      SELECT 1 FROM friendships f
      WHERE f.status = 'accepted'
        AND (
          (f.requester_id = auth.uid() AND f.addressee_id = p_friend_id)
          OR (f.requester_id = p_friend_id AND f.addressee_id = auth.uid())
        )
    )
  GROUP BY fe.date
  ORDER BY fe.date ASC;
$$;

-- 9. Function: get profiles with reliable email (falls back to auth.users)
CREATE OR REPLACE FUNCTION get_profiles_with_email(p_user_ids uuid[])
RETURNS TABLE(id uuid, display_name text, email text)
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT p.id, p.display_name, COALESCE(p.email, u.email) as email
  FROM profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.id = ANY(p_user_ids);
$$;

-- 10. Backfill: sync emails from auth.users to profiles
UPDATE profiles p SET email = u.email FROM auth.users u WHERE u.id = p.id AND p.email IS NULL;
