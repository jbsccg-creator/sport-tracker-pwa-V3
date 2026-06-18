create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

create table if not exists public.body_weights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  measured_at date not null,
  weight_kg numeric(5,2) not null,
  created_at timestamptz not null default now(),
  constraint body_weights_user_date_unique unique (user_id, measured_at)
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_id text not null,
  session_date date not null,
  week_number integer,
  week_type text,
  day_label text,
  title text,
  session_type text,
  completed boolean not null default false,
  non_cardio_duration_seconds integer default 0,
  rpe integer,
  back_pain integer,
  notes text,
  run_distance_km numeric(6,2),
  run_duration_seconds integer,
  run_avg_speed_kmh numeric(6,2),
  run_pace_seconds_per_km integer,
  bike_distance_km numeric(6,2),
  bike_duration_seconds integer,
  bike_avg_speed_kmh numeric(6,2),
  total_volume_kg numeric(12,2) default 0,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sessions_user_local_unique unique (user_id, local_id)
);

create table if not exists public.exercise_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  exercise_name text not null,
  muscle_group text,
  set_index integer not null,
  planned text,
  completed boolean not null default false,
  reps integer,
  duration_seconds integer,
  distance_km numeric(6,2),
  load_kg numeric(7,2),
  bodyweight_kg numeric(5,2),
  volume_kg numeric(10,2),
  created_at timestamptz not null default now()
);

create table if not exists public.daily_routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  routine_date date not null,
  completed boolean not null default false,
  back_pain integer,
  notes text,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.body_weights enable row level security;
alter table public.sessions enable row level security;
alter table public.exercise_sets enable row level security;
alter table public.daily_routines enable row level security;

create policy "profiles_select_own" on public.profiles for select using ((select auth.uid()) = id);
create policy "profiles_insert_own" on public.profiles for insert with check ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles for update using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "body_weights_select_own" on public.body_weights for select using ((select auth.uid()) = user_id);
create policy "body_weights_insert_own" on public.body_weights for insert with check ((select auth.uid()) = user_id);
create policy "body_weights_update_own" on public.body_weights for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "body_weights_delete_own" on public.body_weights for delete using ((select auth.uid()) = user_id);

create policy "sessions_select_own" on public.sessions for select using ((select auth.uid()) = user_id);
create policy "sessions_insert_own" on public.sessions for insert with check ((select auth.uid()) = user_id);
create policy "sessions_update_own" on public.sessions for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "sessions_delete_own" on public.sessions for delete using ((select auth.uid()) = user_id);

create policy "exercise_sets_select_own" on public.exercise_sets for select using ((select auth.uid()) = user_id);
create policy "exercise_sets_insert_own" on public.exercise_sets for insert with check ((select auth.uid()) = user_id);
create policy "exercise_sets_update_own" on public.exercise_sets for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "exercise_sets_delete_own" on public.exercise_sets for delete using ((select auth.uid()) = user_id);

create policy "daily_routines_select_own" on public.daily_routines for select using ((select auth.uid()) = user_id);
create policy "daily_routines_insert_own" on public.daily_routines for insert with check ((select auth.uid()) = user_id);
create policy "daily_routines_update_own" on public.daily_routines for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "daily_routines_delete_own" on public.daily_routines for delete using ((select auth.uid()) = user_id);
