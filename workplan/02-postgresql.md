# Phase 2. PostgreSQL, access control, and session transactions

The browser uses Supabase for identity and the private Realtime subscription. Next.js validates the user and talks to PostgreSQL with a limited runtime login. Keep application tables outside the exposed schemas and configure Realtime for private channels. [Supabase Realtime authorization](https://supabase.com/docs/guides/realtime/authorization)

## Configure PostgreSQL

1. In the demo project’s Connect panel, copy the session-pooler URI for the database owner into `MIGRATION_DATABASE_URL` in `.env.local`. A compatible direct URI works as well.
2. Set a strong random `PARKING_RUNTIME_PASSWORD` of at least 24 characters. Run the migration and runtime provision commands. Run provisioning again only to rotate the runtime password.
3. For `DATABASE_URL`, use the transaction-pooler connection details with runtime username `parking_runtime.PROJECT_REF`. Keep the host, port, and database name supplied by your project, and percent-encode special characters in the runtime password. The code disables prepared statements for transaction pooling. [Supabase serverless database connections](https://supabase.com/docs/guides/database/connecting-to-postgres/serverless-drivers)
4. Create and confirm your administrator identity in Supabase Auth. Set `BOOTSTRAP_ADMIN_EMAIL` and run the bootstrap command against the same environment. Subsequent applicants create profiles when they first sign in.

For verified TLS, download the Supabase CA from **Database Settings → SSL Configuration**. Set `DATABASE_SSL_CA` to the PEM contents for the app. For operator scripts, set `NODE_EXTRA_CA_CERTS` in the shell to the downloaded certificate path before running Node and use `sslmode=verify-full` in the migration URI. [Supabase SSL guidance](https://supabase.com/docs/guides/database/connecting-to-postgres#ssl)

```powershell
npm run db:migrate
npm run db:runtime
npm run db:admin
```

Partial unique indexes enforce one active session per space and vehicle. The account row locks before the user limit is checked. A claim validates authorization and operational state in one transaction. Closure updates lock the same zone or space rows. Ending a session in a closed zone leaves that space unavailable. Parking and staff corrections persist an audit record in the same transaction. A failed or interrupted response can be retried using the original idempotency key.

`app.profiles.role` stores the account role. Server authorization derives Driver, Security Officer, or Administrator access from the verified account and its current role. Parking claims also match the role and vehicle type against `app.access_rules`, or use a current account-specific entry in `app.access_grants`. These checks apply to a privileged account's own parking claims as well.

**Exit check** Run migration twice and confirm the second run skips applied SQL. Use `DATABASE_URL` to verify that the app can read inventory using the limited login. Exercise the hosted connection pooler during the Vercel smoke test. After the UI is installed, sign in with the bootstrapped administrator and confirm Operations opens.

## Complete source files

### `sql/001_schema.sql`

<!-- file: sql/001_schema.sql -->

```sql
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
```

### `sql/002_sessions.sql`

<!-- file: sql/002_sessions.sql -->

```sql
create function app.claim(p_actor uuid, p_vehicle uuid, p_space uuid, p_key uuid, p_pilot boolean)
returns uuid language plpgsql set search_path = '' as $$
declare
  account app.profiles%rowtype;
  vehicle app.vehicles%rowtype;
  zone app.zones%rowtype;
  space app.spaces%rowtype;
  prior app.requests%rowtype;
  new_id uuid;
  f text := p_vehicle::text || ':' || p_space::text;
  z uuid;
begin
  insert into app.requests(actor,operation,request_key,fingerprint)
    values (p_actor,'claim',p_key,f) on conflict do nothing;
  select * into prior from app.requests
    where actor=p_actor and operation='claim' and request_key=p_key for update;
  select * into account from app.profiles where id=p_actor for no key update;
  if account.id is null or not account.verified or account.suspended then
    raise exception 'PARKING_FORBIDDEN' using errcode='P0001';
  end if;
  if prior.fingerprint <> f then raise exception 'REQUEST_REUSED' using errcode='P0001'; end if;
  if prior.result_id is not null then return prior.result_id; end if;

  select * into vehicle from app.vehicles where id=p_vehicle and user_id=p_actor and archived_at is null
    for no key update;
  if vehicle.id is null then raise exception 'PARKING_FORBIDDEN' using errcode='P0001'; end if;
  select zone_id into z from app.spaces where id=p_space;
  select * into zone from app.zones where id=z for no key update;
  select * into space from app.spaces where id=p_space for no key update;
  if space.id is null or not zone.open or not zone.published or not space.published
      or space.state <> 'open' or (p_pilot and (not zone.verified or not space.verified))
      or exists(select 1 from app.sessions where space_id=p_space and ended_at is null) then
    raise exception 'SPACE_UNAVAILABLE' using errcode='P0001';
  end if;
  if not (
    exists(select 1 from app.access_rules where zone_id=z and role=account.role and kind=vehicle.kind)
    or exists(select 1 from app.access_grants where zone_id=z and user_id=p_actor
      and kind=vehicle.kind and expires_at>clock_timestamp())
  ) then raise exception 'PARKING_FORBIDDEN' using errcode='P0001'; end if;
  if (select count(*) from app.sessions where user_id=p_actor and ended_at is null) >= account.max_sessions
      or exists(select 1 from app.sessions where vehicle_id=p_vehicle and ended_at is null) then
    raise exception 'ACTIVE_SESSION_LIMIT' using errcode='P0001';
  end if;
  insert into app.sessions(user_id,vehicle_id,space_id) values (p_actor,p_vehicle,p_space) returning id into new_id;
  insert into app.activity(actor,action,target,zone_id) values (p_actor,'session.start',new_id,z);
  update app.requests set result_id=new_id where actor=p_actor and operation='claim' and request_key=p_key;
  return new_id;
end; $$;

create function app.release(p_actor uuid, p_session uuid, p_key uuid, p_reason text)
returns uuid language plpgsql set search_path = '' as $$
declare
  account app.profiles%rowtype;
  current_session app.sessions%rowtype;
  prior app.requests%rowtype;
  z uuid;
  f text := p_session::text || ':' || coalesce(p_reason,'');
begin
  insert into app.requests(actor,operation,request_key,fingerprint)
    values (p_actor,'release',p_key,f) on conflict do nothing;
  select * into prior from app.requests
    where actor=p_actor and operation='release' and request_key=p_key for update;
  select * into account from app.profiles where id=p_actor for no key update;
  if account.id is null or not account.verified or account.suspended then
    raise exception 'PARKING_FORBIDDEN' using errcode='P0001';
  end if;
  select * into current_session from app.sessions where id=p_session;
  if current_session.id is null or (current_session.user_id <> p_actor and
      (account.role not in ('admin','officer') or coalesce(length(trim(p_reason)),0)<3)) then
    raise exception 'PARKING_FORBIDDEN' using errcode='P0001';
  end if;
  if prior.fingerprint <> f then raise exception 'REQUEST_REUSED' using errcode='P0001'; end if;
  if prior.result_id is not null then return prior.result_id; end if;

  perform id from app.vehicles where id=current_session.vehicle_id for no key update;
  select zone_id into z from app.spaces where id=current_session.space_id;
  perform id from app.zones where id=z for no key update;
  perform id from app.spaces where id=current_session.space_id for no key update;
  select * into current_session from app.sessions where id=p_session for no key update;
  if current_session.ended_at is null then
    update app.sessions set ended_at=clock_timestamp(), ended_by=p_actor,
      end_reason=coalesce(p_reason,'Driver departed') where id=p_session;
    insert into app.activity(actor,action,target,zone_id,reason)
      values (p_actor,'session.end',p_session,z,p_reason);
  end if;
  update app.requests set result_id=p_session where actor=p_actor and operation='release' and request_key=p_key;
  return p_session;
end; $$;

revoke all on function app.claim(uuid,uuid,uuid,uuid,boolean) from public;
revoke all on function app.release(uuid,uuid,uuid,text) from public;
grant execute on function app.claim(uuid,uuid,uuid,uuid,boolean) to parking_runtime;
grant execute on function app.release(uuid,uuid,uuid,text) to parking_runtime;
```

### `sql/003_realtime.sql`

<!-- file: sql/003_realtime.sql -->

```sql
create policy "parking broadcast receive"
on realtime.messages for select to authenticated
using ((select realtime.topic()) = 'parking-campus' and extension = 'broadcast');

create function app.broadcast_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.zone_id is not null and new.action in (
    'session.start', 'session.end', 'zone.save', 'space.save', 'rules.access', 'grant.save'
  ) then
    perform realtime.send(
      jsonb_build_object('zoneId',new.zone_id,'at',new.at),
      'parking.changed','parking-campus',true
    );
  end if;
  return new;
end; $$;
revoke all on function app.broadcast_activity() from public;
create trigger activity_parking_broadcast after insert on app.activity
for each row execute function app.broadcast_activity();
```

### `scripts/migrate.mjs`

<!-- file: scripts/migrate.mjs -->

```js
import { readdir, readFile } from "node:fs/promises";
import postgres from "postgres";

if (!process.env.MIGRATION_DATABASE_URL) throw new Error("MIGRATION_DATABASE_URL is required");
const db = postgres(process.env.MIGRATION_DATABASE_URL, { max: 1, prepare: false });
try {
  await db`create table if not exists public.parking_migrations (
    name text primary key, applied_at timestamptz not null default now()
  )`;
  await db`revoke all on public.parking_migrations from public, anon, authenticated`;
  for (const name of (await readdir("sql")).filter((file) => file.endsWith(".sql")).sort()) {
    const text = await readFile(new URL("../sql/" + name, import.meta.url), "utf8");
    await db.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(190086042)`;
      if ((await tx`select 1 from public.parking_migrations where name=${name}`).length) return;
      await tx.unsafe(text);
      await tx`insert into public.parking_migrations(name) values (${name})`;
      console.log("Applied", name);
    });
  }
} finally {
  await db.end();
}
```

### `scripts/provision-runtime.mjs`

<!-- file: scripts/provision-runtime.mjs -->

```js
import postgres from "postgres";

const { MIGRATION_DATABASE_URL: url, PARKING_RUNTIME_PASSWORD: password } = process.env;
if (!url || !password || password.length < 24) throw new Error("Set the migration URL and a runtime password of at least 24 characters.");
const db = postgres(url, { max: 1, prepare: false });
try {
  const [command] = await db`select format('alter role parking_runtime login password %L', ${password}::text) as ddl`;
  await db.unsafe(command.ddl);
  console.log("Runtime login enabled. Add its pooled URL to DATABASE_URL.");
} finally {
  await db.end();
}
```

### `scripts/bootstrap-admin.mjs`

<!-- file: scripts/bootstrap-admin.mjs -->

```js
import postgres from "postgres";

const { MIGRATION_DATABASE_URL: url, BOOTSTRAP_ADMIN_EMAIL: email } = process.env;
if (!url || !email) throw new Error("Set MIGRATION_DATABASE_URL and BOOTSTRAP_ADMIN_EMAIL.");
const db = postgres(url, { max: 1, prepare: false });
try {
  await db.begin(async (tx) => {
    const [user] = await tx`select id from auth.users where lower(email)=lower(${email}) and email_confirmed_at is not null`;
    if (!user) throw new Error("Create and confirm the administrator identity in Supabase Auth first.");
    await tx`insert into app.profiles(id,name,registration,role,verified)
      values (${user.id}, 'Parking administrator', 'campus', 'admin', true)
      on conflict (id) do update set role='admin', verified=true, suspended=false`;
    await tx`insert into app.activity(actor,action,target,reason)
      values (${user.id},'account.bootstrap',${user.id},'Deployment operator bootstrap')`;
  });
  console.log("Administrator account configured.");
} finally {
  await db.end();
}
```

### `src/server/db.ts`

<!-- file: src/server/db.ts -->

```ts
import "server-only";
import postgres from "postgres";

const singleton = globalThis as typeof globalThis & { parkingDb?: ReturnType<typeof postgres> };
export function database() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required.");
  const ca = process.env.DATABASE_SSL_CA?.trim();
  const ssl = ca ? { ca, rejectUnauthorized: true } : undefined;
  return (singleton.parkingDb ??= postgres(url, { prepare: false, max: 4, idle_timeout: 20, ssl }));
}
export type Transaction = postgres.TransactionSql;
```

### `src/server/errors.ts`

<!-- file: src/server/errors.ts -->

```ts
import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message); }
}

export function response(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}

const dbErrors: Record<string, [number, string]> = {
  PARKING_FORBIDDEN: [403, "Your account or vehicle cannot perform this action."],
  SPACE_UNAVAILABLE: [409, "This space is no longer available. Refresh and select an eligible space."],
  ACTIVE_SESSION_LIMIT: [409, "End an active session before starting another."],
  REQUEST_REUSED: [409, "This request key was already used with different details."],
};

export function errorResponse(error: unknown) {
  if (error instanceof ApiError) return response({ code: error.code, message: error.message }, error.status);
  if (error instanceof ZodError || error instanceof SyntaxError)
    return response({ code: "INVALID_INPUT", message: "Check the submitted values and try again." }, 422);
  const pg = error as { code?: string; message?: string; constraint_name?: string };
  const match = pg?.code === "P0001" ? dbErrors[pg.message ?? ""] : undefined;
  if (match) return response({ code: pg.message, message: match[1] }, match[0]);
  if (pg?.code === "23505" && pg.constraint_name === "vehicle_plate_active")
    return response({ code: "PLATE_IN_USE", message: "This registration is already active. Contact an administrator if you share the vehicle." }, 409);
  if (pg?.code === "23505") return response({ code: "DUPLICATE", message: "That code or active record already exists." }, 409);
  if (pg?.code === "40P01" || pg?.code === "40001")
    return response({ code: "RETRY", message: "An update overlapped yours. Try the same action again." }, 409);
  console.error("parking-request-failed", { type: error instanceof Error ? error.name : "unknown", code: pg?.code });
  return response({ code: "UNAVAILABLE", message: "The parking service is temporarily unavailable." }, 503);
}
```

### `src/server/viewer.ts`

<!-- file: src/server/viewer.ts -->

```ts
import "server-only";
import { serverAuth } from "./auth";
import { database, type Transaction } from "./db";
import { ApiError } from "./errors";
import type { Role } from "@/lib/contracts";

export type Viewer = {
  id: string; name: string; role: Role; verified: boolean; suspended: boolean;
  registration: "campus" | "visitor"; max_sessions: number;
};
const elevated = (role: Role) => role === "admin" || role === "officer";

export async function viewer(): Promise<Viewer> {
  const auth = (await serverAuth()).auth;
  const { data: { user } } = await auth.getUser();
  if (!user?.email_confirmed_at) throw new ApiError(401, "AUTH_REQUIRED", "Sign in with a verified email address.");

  const db = database();
  let [profile] = await db<Viewer[]>`select * from app.profiles where id=${user.id}`;
  if (!profile) {
    const registration = user.user_metadata.registration === "campus" ? "campus" : "visitor";
    const name = String(user.user_metadata.display_name || "Campus driver").trim().slice(0, 100) || "Campus driver";
    await db`insert into app.profiles(id,name,registration,verified)
      values (${user.id},${name},${registration},${registration === "visitor"}) on conflict do nothing`;
    [profile] = await db<Viewer[]>`select * from app.profiles where id=${user.id}`;
  }
  if (!profile || profile.suspended) throw new ApiError(403, "ACCOUNT_UNAVAILABLE", "Contact the parking administrator.");
  if (process.env.APP_ENV === "pilot" && elevated(profile.role)) {
    const { data } = await auth.mfa.getAuthenticatorAssuranceLevel();
    if (data?.currentLevel !== "aal2") {
      throw new ApiError(403, "MFA_REQUIRED", "An authenticated MFA session is required for this staff account.");
    }
  }
  return profile;
}

export function requireAccess(user: Viewer, level: "driver" | "officer" | "admin") {
  if (user.suspended || !user.verified || (level === "admin" && user.role !== "admin") ||
      (level === "officer" && !elevated(user.role))) {
    throw new ApiError(403, "PARKING_FORBIDDEN", "Your account does not have permission for this action.");
  }
}

export async function lockActor(tx: Transaction, user: Viewer, level: "driver" | "officer" | "admin") {
  const [current] = await tx<Viewer[]>`select * from app.profiles where id=${user.id} for no key update`;
  if (!current || current.role !== user.role) throw new ApiError(403, "PARKING_FORBIDDEN", "Your account changed. Refresh and try again.");
  requireAccess(current, level);
  return current;
}
```
