-- Run this in the Supabase SQL editor to create the favorites table

create table if not exists favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  food_name text not null,
  calories integer not null,
  protein real,
  carbs real,
  fat real,
  serving_qty real,
  created_at timestamptz default now()
);

alter table favorites enable row level security;

create policy "Users can manage their own favorites"
  on favorites for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
