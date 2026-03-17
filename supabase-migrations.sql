-- Run these in the Supabase SQL editor to add streak columns to profiles.
-- Safe to run multiple times (IF NOT EXISTS).

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS streak_count integer NOT NULL DEFAULT 0;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_streak_date date;
