-- Friends Feature v3 - Run AFTER v2
-- Adds: friend calories RPC, updates workouts/weight to year-based

-- 1. Function: get friend's calories per day for current week
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

-- 2. Update get_friend_workouts: fetch from start of year
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

-- 3. Update get_friend_weight: fetch from start of year
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
