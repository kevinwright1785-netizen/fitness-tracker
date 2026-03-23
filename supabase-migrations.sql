-- Run these in the Supabase SQL editor.
-- All statements use IF NOT EXISTS — safe to run multiple times.

-- ── Streak columns on profiles ───────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS streak_count integer NOT NULL DEFAULT 0;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_streak_date date;

-- ── meal_type and serving_qty on food_logs ───────────────────────────────────
ALTER TABLE food_logs
  ADD COLUMN IF NOT EXISTS meal_type text
    CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack'));

ALTER TABLE food_logs
  ADD COLUMN IF NOT EXISTS serving_qty numeric;

-- ── saved_meals table ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS saved_meals (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  calories    integer NOT NULL,
  protein     numeric,
  carbs       numeric,
  fat         numeric,
  ingredients jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- RLS for saved_meals
ALTER TABLE saved_meals ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "saved_meals: user owns rows"
  ON saved_meals FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
