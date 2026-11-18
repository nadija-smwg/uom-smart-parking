create schema app;
revoke all on schema app from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'parking_runtime') then
    create role parking_runtime nologin;
  end if;
end; $$;

create type app.user_role as enum ('student','lecturer','staff','visitor','officer','admin');
create type app.vehicle_type as enum ('car','van','motorcycle','bicycle','university','other');
create type app.category as enum ('cars','motorcycles','bicycles','university','other');
create type app.space_state as enum ('open','closed','blocked','under_review','retired');

create table app.profiles (
  id uuid primary key references auth.users(id),
  name text not null check (length(name) between 1 and 100),
  role app.user_role not null default 'visitor',
  registration text not null check (registration in ('campus','visitor')),
  verified boolean not null default false, suspended boolean not null default false,
  max_sessions integer not null default 1 check (max_sessions between 1 and 10),
  created_at timestamptz not null default now()
);
create table app.vehicles (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references app.profiles,
  kind app.vehicle_type not null, plate text, normalized_plate text,
  model text not null default '', color text not null default '', archived_at timestamptz,
  check ((kind = 'bicycle' and plate is null and normalized_plate is null)
      or (plate is not null and normalized_plate is not null and length(normalized_plate) between 3 and 20))
);
create unique index vehicle_plate_active on app.vehicles(normalized_plate)
  where archived_at is null and normalized_plate is not null;
create index vehicle_owner on app.vehicles(user_id);

create table app.zones (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^Z[0-9]{2,5}$'),
  name text not null check (length(name) between 1 and 100),
  category app.category not null, proposed_capacity integer not null check (proposed_capacity between 0 and 500),
  geometry jsonb not null check (jsonb_typeof(geometry) = 'object'),
  instructions text not null default '', open boolean not null default true,
  published boolean not null default true, verified boolean not null default false,
  version integer not null default 1, updated_at timestamptz not null default now()
);
create table app.spaces (
  id uuid primary key default gen_random_uuid(), zone_id uuid not null references app.zones,
  code text not null unique check (code ~ '^Z[0-9]{2,5}-[0-9]{3,5}$'), x numeric not null, y numeric not null,
  state app.space_state not null default 'open', published boolean not null default true,
  verified boolean not null default false, version integer not null default 1,
  updated_at timestamptz not null default now(),
  check (x between -200 and 1300 and y between -200 and 1000)
);
create index spaces_by_zone on app.spaces(zone_id);
create table app.access_rules (
  zone_id uuid not null references app.zones, role app.user_role not null, kind app.vehicle_type not null,
  primary key (zone_id, role, kind)
);
create table app.access_grants (
  zone_id uuid not null references app.zones, user_id uuid not null references app.profiles, kind app.vehicle_type not null,
  approved_by uuid not null references app.profiles, expires_at timestamptz not null,
  primary key (zone_id, user_id, kind)
);
create table app.sessions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references app.profiles,
  vehicle_id uuid not null references app.vehicles, space_id uuid not null references app.spaces,
  started_at timestamptz not null default clock_timestamp(), ended_at timestamptz,
  ended_by uuid references app.profiles, end_reason text,
  verified_at timestamptz, verified_by uuid references app.profiles,
  check (ended_at is null or (ended_at >= started_at and ended_by is not null))
);
create unique index session_space_active on app.sessions(space_id) where ended_at is null;
create unique index session_vehicle_active on app.sessions(vehicle_id) where ended_at is null;
create index session_user_history on app.sessions(user_id, started_at desc);
create index session_space_history on app.sessions(space_id, started_at desc);

create table app.requests (
  actor uuid not null, operation text not null, request_key uuid not null, fingerprint text not null,
  result_id uuid, created_at timestamptz not null default now(),
  primary key (actor, operation, request_key)
);
create table app.activity (
  id bigint generated always as identity primary key, actor uuid not null, action text not null,
  target uuid not null, zone_id uuid, reason text, details jsonb not null default '{}',
  at timestamptz not null default clock_timestamp()
);
create index activity_by_zone on app.activity(zone_id, at desc);

create table app.reports (
  id uuid primary key default gen_random_uuid(), author uuid not null references app.profiles,
  zone_id uuid not null references app.zones, space_id uuid references app.spaces,
  kind text not null check (kind in ('incorrect','blocked','unauthorized','wrong_category')),
  description text not null check (length(description) between 3 and 800),
  status text not null default 'open' check (status in ('open','resolved')),
  resolution text, reviewed_by uuid references app.profiles, created_at timestamptz not null default now()
);
create index reports_by_state on app.reports(status, created_at desc);

create table app.announcements (
  id uuid primary key default gen_random_uuid(), author uuid not null references app.profiles,
  title text not null check (length(title) between 1 and 120),
  body text not null check (length(body) between 1 and 2000),
  audience app.user_role[] not null default '{}', state text not null default 'draft'
    check (state in ('draft','published','archived')),
  published_at timestamptz, expires_at timestamptz, created_at timestamptz not null default now(),
  check (expires_at is null or published_at is null or expires_at > published_at)
);
create table app.notifications (
  user_id uuid not null references app.profiles, announcement_id uuid not null references app.announcements,
  read_at timestamptz, primary key (user_id, announcement_id)
);
create table app.parking_rules (
  id uuid primary key default gen_random_uuid(), title text not null, body text not null,
  active boolean not null default true, updated_at timestamptz not null default now()
);

grant usage on schema app to parking_runtime;
grant select, insert, update on all tables in schema app to parking_runtime;
grant delete on app.access_rules, app.access_grants to parking_runtime;
revoke update on app.activity from parking_runtime;
grant usage, select on all sequences in schema app to parking_runtime;
