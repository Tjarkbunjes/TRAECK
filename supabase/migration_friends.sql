-- Friends Feature Migration
-- Run this in the Supabase SQL Editor

-- 1. Add email column to profiles (for friend search by email)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email text;

-- 2. Create friendships table
CREATE TABLE IF NOT EXISTS friendships (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  addressee_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  status text DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'accepted')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(requester_id, addressee_id)
);

ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view_own_friendships" ON friendships
  FOR SELECT USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE POLICY "create_friend_requests" ON friendships
  FOR INSERT WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "update_addressed_requests" ON friendships
  FOR UPDATE USING (auth.uid() = addressee_id);

CREATE POLICY "delete_own_friendships" ON friendships
  FOR DELETE USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- 3. Function: search user by email (returns only registered users, excludes self)
CREATE OR REPLACE FUNCTION search_user_by_email(search_email text)
RETURNS TABLE(id uuid, display_name text, email text)
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT p.id, p.display_name, p.email
  FROM profiles p
  WHERE LOWER(p.email) = LOWER(search_email)
    AND p.id != auth.uid();
$$;

-- 4. Function: get friend's workouts (only if accepted friend)
CREATE OR REPLACE FUNCTION get_friend_workouts(p_friend_id uuid, p_days int DEFAULT 90)
RETURNS TABLE(id uuid, date text, name text, finished_at timestamptz)
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT w.id, w.date, w.name, w.finished_at
  FROM workouts w
  WHERE w.user_id = p_friend_id
    AND w.finished_at IS NOT NULL
    AND w.date >= (now() - (p_days || ' days')::interval)::date
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

-- 5. Function: get friend's weight entries (only if accepted friend)
CREATE OR REPLACE FUNCTION get_friend_weight(p_friend_id uuid, p_days int DEFAULT 90)
RETURNS TABLE(date text, weight_kg numeric)
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT we.date, we.weight_kg
  FROM weight_entries we
  WHERE we.user_id = p_friend_id
    AND we.date >= (now() - (p_days || ' days')::interval)::date
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
