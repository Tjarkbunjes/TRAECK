-- Friends Feature v2 - Run AFTER migration_friends.sql
-- Fixes: nickname support, date comparison casts

-- 1. Add nickname column to friendships
ALTER TABLE friendships ADD COLUMN IF NOT EXISTS nickname text;

-- 2. Allow requester to also update friendships (for setting nickname)
DROP POLICY IF EXISTS "update_addressed_requests" ON friendships;
CREATE POLICY "update_own_friendships" ON friendships
  FOR UPDATE USING (auth.uid() = addressee_id OR auth.uid() = requester_id);

-- 3. Fix get_friend_workouts: cast date column explicitly
CREATE OR REPLACE FUNCTION get_friend_workouts(p_friend_id uuid, p_days int DEFAULT 90)
RETURNS TABLE(id uuid, date text, name text, finished_at timestamptz)
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT w.id, w.date::text, w.name, w.finished_at
  FROM workouts w
  WHERE w.user_id = p_friend_id
    AND w.finished_at IS NOT NULL
    AND w.date::date >= (now() - (p_days || ' days')::interval)::date
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

-- 4. Fix get_friend_weight: cast date column explicitly
CREATE OR REPLACE FUNCTION get_friend_weight(p_friend_id uuid, p_days int DEFAULT 90)
RETURNS TABLE(date text, weight_kg numeric)
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT we.date::text, we.weight_kg
  FROM weight_entries we
  WHERE we.user_id = p_friend_id
    AND we.date::date >= (now() - (p_days || ' days')::interval)::date
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
