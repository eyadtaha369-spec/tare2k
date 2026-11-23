-- ─────────────────────────────────────────────────────────────
--  TARE2K — Supabase schema
--  Run once in Supabase Dashboard → SQL Editor.
-- ─────────────────────────────────────────────────────────────

create extension if not exists pgcrypto;

-- Staff (admins & bus supervisors). Link to Supabase Auth users.
create table if not exists public.staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'supervisor' check (role in ('admin', 'supervisor')),
  created_at timestamptz not null default now()
);

-- Booking requests
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  -- Unguessable token used in the public pass URL and the QR code
  pass_token text unique,
  trip_code text not null check (trip_code in ('sat_out','sun_out','wed_ret','thu_ret')),
  trip_date date not null,
  direction text not null check (direction in ('outbound','return')),
  area text not null check (area in ('damanhour','itay','delengat')),
  pickup_spot text not null,
  full_name text not null,
  phone text not null,
  sender_account text not null,
  payment_method text not null check (payment_method in ('vodafone_cash','instapay')),
  receipt_path text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  checked_in_at timestamptz,
  checked_in_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists bookings_trip_idx on public.bookings (trip_code, trip_date, status);
create index if not exists bookings_created_idx on public.bookings (created_at desc);

-- Manual open/close overrides per trip instance
create table if not exists public.trip_overrides (
  trip_code text not null,
  trip_date date not null,
  mode text not null check (mode in ('open','closed')),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key (trip_code, trip_date)
);

-- Lock everything down: the app reads/writes through server routes
-- using the service-role key, after checking the staff table.
alter table public.staff enable row level security;
alter table public.bookings enable row level security;
alter table public.trip_overrides enable row level security;

-- Staff may read their own staff row (used by the login page)
drop policy if exists "staff read self" on public.staff;
create policy "staff read self" on public.staff
  for select using (auth.uid() = user_id);

-- Private bucket for transfer receipts
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────────
--  After creating your first user in Authentication → Users,
--  make them an admin:
--
--  insert into public.staff (user_id, full_name, role)
--  select id, 'Owner', 'admin' from auth.users where email = 'you@example.com';
-- ─────────────────────────────────────────────────────────────
