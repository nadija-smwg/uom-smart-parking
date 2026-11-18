# Phase 4. Driver screens and live parking

The driver app contains Home, Map, Find Parking, My Parking, Profile, and Notices. Register a vehicle, find an eligible space, select it on the map, and confirm once parked. Home links to active sessions. My Parking shows active sessions and recent history. End a session on departure before editing or archiving its vehicle. Report a discrepancy from the selected zone or space.

Home shows available spaces by vehicle category alongside registered vehicles, active sessions, and recent notices. A sidebar provides navigation on desktop and a bottom bar provides the same actions on phones. The Operations entry is visible to verified Security Officers and Administrators.

Student, Lecturer, University Staff, and Visitor use the same Driver pages. The server checks ownership on personal vehicle and session actions. A claim also requires a verified account, an eligible vehicle and zone, and an available space. Security Officers and Administrators use these same checks when parking their own vehicles.

After commit, the database sends a zone-change signal on a private channel. Clients refresh an authorized snapshot and fall back to polling. The app shows when the last snapshot was received, disables writes while offline, and waits for a fresh snapshot for the selected vehicle after reconnect before enabling claims. Driver responses omit other users’ identities and vehicle data.

| Method and route under `/api/v1` | Contract |
| --- | --- |
| `GET home` | Current profile, own vehicles and sessions, inbox, and published rules. |
| `GET campus?vehicle=UUID` | Campus zones and spaces with eligibility for the selected vehicle. |
| `PATCH profile` | Save the signed-in user's name. |
| `POST vehicles`, `PATCH vehicles/UUID`, `DELETE vehicles/UUID` | Create, edit, or archive an owned vehicle. |
| `POST sessions` | Accepts `vehicleId` and `spaceId`. Requires a UUID `Idempotency-Key` header. |
| `POST sessions/UUID/end` | Ends the user's session. Requires a UUID `Idempotency-Key` header. |
| `POST reports` | Submits an issue for a published zone and optional space. |
| `POST notifications/UUID/read` | Marks a notice read for the signed-in recipient. |

**Exit check** In two browser profiles, use two drivers and vehicles to claim the same space. Exactly one succeeds. End the winning session and confirm the second browser refreshes. Check loss of connectivity, visitor exclusions, and vehicle editing while a session is active.

## Verification results

The production build and campus tests passed. Integration checks used two Chrome profiles at desktop and phone widths, isolated PostgreSQL with the application migrations, and local Auth and Realtime test adapters.

- Two drivers tried to claim the same space concurrently. One received a session and the other received a conflict. Retrying with the same request key and details returned the original session ID. After the winning driver left, the second browser refreshed to show the open space.
- Offline mode disabled claiming. Reconnecting kept the claim disabled until the new snapshot arrived. Polling refreshed availability with the Realtime socket down.
- The API enforced visitor exclusions and ownership for vehicles and sessions. Vehicle editing and archival were blocked during a session and succeeded after departure. Reports and notice read status persisted.

A read-only check of the hosted demo confirmed the runtime's claim and release permissions, the broadcast trigger, and the private receive policy. A hosted sign-in and Realtime smoke test remains for Phase 6.

## Complete source files

### `src/server/driver.ts`

<!-- file: src/server/driver.ts -->

```ts
import "server-only";
import { z } from "zod";
import { database, type Transaction } from "./db";
import { ApiError } from "./errors";
import { lockActor, requireAccess, type Viewer } from "./viewer";
import { kinds, type Notice, type Profile, type Rule, type Session, type Space, type Vehicle, type Zone } from "@/lib/contracts";

export const uuid = z.uuid();
export const text = (count: number) => z.string().trim().min(1).max(count);
export const reason = z.string().trim().min(3).max(500);
const pilot = () => process.env.APP_ENV === "pilot";

export async function snapshot(user: Viewer, vehicleId: string | null) {
  const db = database();
  const v = vehicleId ? uuid.parse(vehicleId) : null;
  return db.begin("isolation level repeatable read read only", async (tx) => {
    const zones = await tx<Zone[]>`
      select z.*, count(s.id)::int as inventory,
        (count(*) filter (where q.id is not null))::int as occupied,
        (count(*) filter (where s.id is not null and q.id is null and z.open and s.state='open'
          and (not ${pilot()} or (s.verified and z.verified))))::int as available
      from app.zones z
      left join app.spaces s on s.zone_id=z.id and s.published and s.state<>'retired'
      left join app.sessions q on q.space_id=s.id and q.ended_at is null
      where z.published group by z.id order by z.code`;
    const spaces = await tx<Space[]>`
      select s.id,s.zone_id,z.name as zone_name,z.code as zone_code,s.code,s.x::float8,s.y::float8,
        s.state,s.published,s.verified,s.version,q.id is not null as occupied,
        (q.id is null and z.open and s.state='open' and (not ${pilot()} or (s.verified and z.verified))) as available,
        (${user.verified} and v.id is not null and (
          exists(select 1 from app.access_rules r where r.zone_id=z.id and r.role=${user.role} and r.kind=v.kind)
          or exists(select 1 from app.access_grants g where g.zone_id=z.id and g.user_id=${user.id}
              and g.kind=v.kind and g.expires_at>now()))) as eligible,
        greatest(s.updated_at,z.updated_at, recent.at) as updated_at
      from app.spaces s join app.zones z on z.id=s.zone_id
      left join app.sessions q on q.space_id=s.id and q.ended_at is null
      left join app.vehicles v on v.id=${v}::uuid and v.user_id=${user.id} and v.archived_at is null
      left join lateral (select greatest(started_at,ended_at,verified_at) as at
        from app.sessions where space_id=s.id order by started_at desc limit 1) recent on true
      where s.published and z.published and s.state<>'retired' order by s.code`;
    return { zones, spaces, syncedAt: new Date().toISOString() };
  });
}

export async function home(user: Viewer) {
  const db = database();
  const [vehicles, sessions, notices, rules] = await Promise.all([
    db<Vehicle[]>`select id,kind,plate,model,color from app.vehicles where user_id=${user.id}
      and archived_at is null order by kind,plate`,
    db<(Session & { vehicle_id: string; space_id: string })[]>`select q.id,q.vehicle_id,q.space_id,q.started_at,q.ended_at,s.code,z.name as zone_name,v.kind,v.plate
      from app.sessions q join app.spaces s on s.id=q.space_id join app.zones z on z.id=s.zone_id
      join app.vehicles v on v.id=q.vehicle_id where q.user_id=${user.id}
      order by (q.ended_at is null) desc,q.started_at desc limit 100`,
    db<Notice[]>`select a.id,a.title,a.body,a.published_at,n.read_at
      from app.announcements a
      left join app.notifications n on n.announcement_id=a.id and n.user_id=${user.id}
      where a.state='published' and (a.expires_at is null or a.expires_at>now())
      and (cardinality(a.audience)=0 or ${user.role}=any(a.audience))
      order by a.published_at desc limit 100`,
    db<Rule[]>`select id,title,body from app.parking_rules where active order by updated_at desc limit 100`,
  ]);
  const { id, name, role, registration, verified } = user;
  return { profile: { id, name, role, registration, verified }, vehicles, sessions, notices, rules };
}

export async function saveProfile(user: Viewer, input: unknown) {
  const { name } = z.object({ name: text(100) }).parse(input);
  const [profile] = await database()<Profile[]>`update app.profiles set name=${name} where id=${user.id}
    and not suspended returning id,name,role,registration,verified`;
  if (!profile) throw new ApiError(403, "ACCOUNT_UNAVAILABLE", "This account is unavailable.");
  return profile;
}

export async function saveVehicle(user: Viewer, input: unknown, id?: string) {
  const value = z.object({
    kind: z.enum(kinds), plate: z.string().trim().max(25), model: z.string().trim().max(100), color: z.string().trim().max(40),
  }).parse(input);
  const plate = value.kind === "bicycle" && !value.plate ? null : value.plate.toUpperCase();
  const normalized = plate?.replace(/[ -]/g, "") ?? null;
  if ((plate !== null && !/^[A-Z0-9]{3,20}$/.test(normalized ?? "")) || (value.kind !== "bicycle" && !plate))
    throw new ApiError(422, "INVALID_PLATE", "Enter a registration using three to twenty letters or digits.");
  return database().begin(async (tx) => {
    await lockActor(tx, user, "driver");
    if (!id) {
      const [row] = await tx<Vehicle[]>`insert into app.vehicles(user_id,kind,plate,normalized_plate,model,color)
        values (${user.id},${value.kind},${plate},${normalized},${value.model},${value.color}) returning id,kind,plate,model,color`;
      return row;
    }
    await lockVehicle(tx, user, id);
    const [row] = await tx<Vehicle[]>`update app.vehicles set kind=${value.kind},plate=${plate},
      normalized_plate=${normalized},model=${value.model},color=${value.color} where id=${id}
      returning id,kind,plate,model,color`;
    return row;
  });
}
async function lockVehicle(tx: Transaction, user: Viewer, id: string) {
  const [vehicle] = await tx`select id from app.vehicles where id=${id} and user_id=${user.id} and archived_at is null for no key update`;
  if (!vehicle) throw new ApiError(404, "VEHICLE_NOT_FOUND", "Vehicle not found.");
  if ((await tx`select id from app.sessions where vehicle_id=${id} and ended_at is null`).length)
    throw new ApiError(409, "ACTIVE_VEHICLE", "End the active session before changing this vehicle.");
}

export async function archiveVehicle(user: Viewer, id: string) {
  await database().begin(async (tx) => {
    await lockActor(tx, user, "driver");
    await lockVehicle(tx, user, id);
    await tx`update app.vehicles set archived_at=now() where id=${id}`;
  });
  return { ok: true };
}

export async function claim(user: Viewer, body: unknown, key: string) {
  requireAccess(user, "driver");
  const { vehicleId, spaceId } = z.object({ vehicleId: uuid, spaceId: uuid }).parse(body);
  const [{ id }] = await database()<{ id: string }[]>`select app.claim(${user.id},${vehicleId},${spaceId},${key},${pilot()}) as id`;
  return { id };
}

export async function release(user: Viewer, id: string, key: string, correction: unknown = null) {
  requireAccess(user, correction === null ? "driver" : "officer");
  const why = correction === null ? null : reason.parse(correction);
  const [{ id: ended }] = await database()<{ id: string }[]>`select app.release(${user.id},${id},${key},${why}) as id`;
  return { id: ended };
}

export async function report(user: Viewer, body: unknown) {
  const value = z.object({
    zoneId: uuid, spaceId: uuid.nullable(), kind: z.enum(["incorrect","blocked","unauthorized","wrong_category"]),
    description: z.string().trim().min(3).max(800),
  }).parse(body);
  return database().begin(async (tx) => {
    await lockActor(tx, user, "driver");
    if (!(await tx`select 1 from app.zones where id=${value.zoneId} and published`).length ||
        (value.spaceId && !(await tx`select 1 from app.spaces where id=${value.spaceId} and zone_id=${value.zoneId} and published`).length))
      throw new ApiError(404, "LOCATION_NOT_FOUND", "Select a published parking location.");
    const [row] = await tx`insert into app.reports(author,zone_id,space_id,kind,description)
      values (${user.id},${value.zoneId},${value.spaceId},${value.kind},${value.description}) returning id`;
    return row;
  });
}

export async function markRead(user: Viewer, id: string) {
  return database().begin(async (tx) => {
    const [actor] = await tx<Viewer[]>`select * from app.profiles where id=${user.id} for no key update`;
    if (!actor || actor.suspended || actor.role !== user.role)
      throw new ApiError(403, "ACCOUNT_UNAVAILABLE", "Refresh the app to check your account access.");
    const [notice] = await tx`select id from app.announcements where id=${id} and state='published'
      and (expires_at is null or expires_at>now())
      and (cardinality(audience)=0 or ${actor.role}=any(audience)) for share`;
    if (!notice) throw new ApiError(404, "NOTICE_NOT_FOUND", "This notice is unavailable.");
    await tx`insert into app.notifications(user_id,announcement_id,read_at) values (${actor.id},${id},now())
      on conflict(user_id,announcement_id) do update set read_at=coalesce(app.notifications.read_at,excluded.read_at)`;
    return { ok: true };
  });
}
```

### `src/app/api/v1/[...path]/route.ts`

<!-- file: src/app/api/v1/[...path]/route.ts -->

```ts
import type { NextRequest } from "next/server";
import * as driver from "@/server/driver";
import { ApiError, errorResponse, response } from "@/server/errors";
import { viewer } from "@/server/viewer";
import { staffRoute } from "@/server/staff-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };

async function handle(request: NextRequest, { params }: Context) {
  try {
    if (request.method !== "GET") {
      const expected = new URL(process.env.APP_ORIGIN ?? request.nextUrl.origin).origin;
      if (request.headers.get("origin") !== expected)
        throw new ApiError(403, "ORIGIN_REQUIRED", "This request must come from the parking application.");
      if (Number(request.headers.get("content-length") ?? 0) > 64_000)
        throw new ApiError(413, "TOO_LARGE", "The submitted data is too large.");
    }
    const user = await viewer();
    const segments = (await params).path;
    const [area, item, action] = segments;
    const route = request.method + " " + segments.join("/");
    const body = () => request.json() as Promise<unknown>;
    const key = () => driver.uuid.parse(request.headers.get("idempotency-key"));
    if (area === "officer" || area === "admin") return await staffRoute(request, segments, user);
    if (route === "GET home") return response(await driver.home(user));
    if (route === "GET campus") return response(await driver.snapshot(user, request.nextUrl.searchParams.get("vehicle")));
    if (route === "PATCH profile") return response(await driver.saveProfile(user, await body()));
    if (route === "POST vehicles") return response(await driver.saveVehicle(user, await body()), 201);
    if (area === "vehicles" && segments.length === 2) {
      const id = driver.uuid.parse(item);
      if (request.method === "PATCH") return response(await driver.saveVehicle(user, await body(), id));
      if (request.method === "DELETE") return response(await driver.archiveVehicle(user, id));
    }
    if (route === "POST sessions") return response(await driver.claim(user, await body(), key()), 201);
    if (request.method === "POST" && segments.length === 3) {
      if (area === "sessions" && action === "end") return response(await driver.release(user, driver.uuid.parse(item), key()));
      if (area === "notifications" && action === "read") return response(await driver.markRead(user, driver.uuid.parse(item)));
    }
    if (route === "POST reports") return response(await driver.report(user, await body()), 201);
    throw new ApiError(404, "NOT_FOUND", "This endpoint does not exist.");
  } catch (error) {
    return errorResponse(error);
  }
}

export { handle as GET, handle as POST, handle as PATCH, handle as DELETE };
```

### `src/app/parking/page.tsx`

<!-- file: src/app/parking/page.tsx -->

```tsx
import { redirect } from "next/navigation";
import { ParkingApp } from "@/components/parking-app";
import { ApiError } from "@/server/errors";
import { viewer } from "@/server/viewer";

export const dynamic = "force-dynamic";

export default async function ParkingPage() {
  try {
    const { id, name, role, verified, registration } = await viewer();
    return <ParkingApp initialProfile={{ id, name, role, verified, registration }} demo={process.env.APP_ENV !== "pilot"} />;
  } catch (error) {
    if (error instanceof ApiError && error.code === "MFA_REQUIRED") redirect("/account?mode=mfa");
    if (error instanceof ApiError && error.status === 401) redirect("/account");
    if (error instanceof ApiError && error.code === "ACCOUNT_UNAVAILABLE")
      return <main className="shell"><h1>Account unavailable</h1><p>Contact the parking administrator.</p></main>;
    throw error;
  }
}
```

### `src/lib/api.ts`

<!-- file: src/lib/api.ts -->

```ts
"use client";

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body) headers.set("Content-Type", "application/json");
  const result = await fetch("/api/v1/" + path, { ...options, headers, cache: "no-store" });
  const json = await result.json();
  if (!result.ok) throw new Error(json.message ?? "The request failed.");
  return json as T;
}

export function mutation(data: unknown, method = "POST", key?: string): RequestInit {
  return { method, body: JSON.stringify(data), headers: key ? { "Idempotency-Key": key } : undefined };
}

export function campusTime(value: string) {
  return new Intl.DateTimeFormat("en-LK", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Colombo",
  }).format(new Date(value));
}
```

### `src/components/realtime.ts`

<!-- file: src/components/realtime.ts -->

```ts
"use client";

import { useEffect, useRef } from "react";
import { browserAuth } from "@/lib/supabase-browser";

export function useParkingUpdates(refresh: () => void, setOnline: (online: boolean) => void) {
  const callback = useRef(refresh);
  callback.current = refresh;
  useEffect(() => {
    const supa = browserAuth();
    let channel: ReturnType<typeof supa.channel> | undefined;
    let closed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let subscribed = false;
    let lastPoll = Date.now();
    const schedule = () => {
      if (closed || timer || !navigator.onLine || document.hidden) return;
      timer = setTimeout(() => {
        timer = undefined;
        if (!closed && navigator.onLine && !document.hidden) callback.current();
      }, 300);
    };
    const network = () => {
      setOnline(navigator.onLine);
      schedule();
    };
    void supa.auth.getSession().then(async ({ data }) => {
      if (closed || !data.session) return;
      await supa.realtime.setAuth();
      if (closed) return;
      channel = supa.channel("parking-campus", { config: { private: true } })
        .on("broadcast", { event: "parking.changed" }, schedule)
        .subscribe((status) => { subscribed = status === "SUBSCRIBED"; schedule(); });
    }).catch(() => { subscribed = false; });
    const poll = setInterval(() => {
      if (!document.hidden && Date.now() - lastPoll >= (subscribed ? 60_000 : 15_000)) {
        lastPoll = Date.now();
        schedule();
      }
    }, 5000);
    window.addEventListener("online", network);
    window.addEventListener("offline", network);
    window.addEventListener("focus", schedule);
    document.addEventListener("visibilitychange", schedule);
    network();
    return () => {
      closed = true;
      clearTimeout(timer);
      clearInterval(poll);
      if (channel) void supa.removeChannel(channel);
      window.removeEventListener("online", network);
      window.removeEventListener("offline", network);
      window.removeEventListener("focus", schedule);
      document.removeEventListener("visibilitychange", schedule);
    };
  }, [setOnline]);
}
```

### `src/components/parking-overview.tsx`

<!-- file: src/components/parking-overview.tsx -->

```tsx
import Image from "next/image";
import { ArrowRight, Bell, Bike, CarFront, History, Map, MapPin, SquareParking } from "lucide-react";
import { campusTime } from "@/lib/api";
import { categories, categoryDisplay, type Notice, type Session, type Zone } from "@/lib/contracts";

export function ParkingOverview({ name, zones, vehicleCount, active, notices, onFind, onMap, onSessions, onNotices }: {
  name: string;
  zones?: Zone[];
  vehicleCount: number;
  active: Session[];
  notices: Notice[];
  onFind: () => void;
  onMap: () => void;
  onSessions: () => void;
  onNotices: () => void;
}) {
  const metrics = [
    { label: "Available spaces", value: zones?.reduce((sum, zone) => sum + zone.available, 0), icon: SquareParking, tone: "green" },
    { label: "Active sessions", value: zones && active.length, icon: History, tone: "blue" },
    { label: "Registered vehicles", value: zones && vehicleCount, icon: CarFront, tone: "sand" },
  ];

  return <div className="dashboard">
    <section className="dashboard-hero">
      <div className="dashboard-copy">
        <h1>Welcome, <span>{name}</span></h1>
        <p>Check campus availability and find a space for your vehicle.</p>
        <div className="actions">
          <button className="scene-action" onClick={onFind}>Find Parking <ArrowRight size={17} aria-hidden="true" /></button>
          <button className="hero-map-action" onClick={onMap}><Map size={18} aria-hidden="true" /> View campus</button>
        </div>
      </div>
      <figure className="campus-art dashboard-art">
        <Image src="/campus-evening.webp" alt="" fill sizes="(max-width: 720px) 94vw, (max-width: 1000px) 40vw, 565px" loading="eager" />
        <figcaption className="art-label"><MapPin size={14} aria-hidden="true" /> Campus illustration</figcaption>
      </figure>
    </section>

    <section className="metrics" aria-label="Parking at a glance">
      {metrics.map(({ icon: Icon, label, value, tone }) => <div className="card metric" key={label}>
        <span className="feature-icon" data-tone={tone}><Icon size={21} aria-hidden="true" /></span>
        <div><strong>{value ?? "—"}</strong><span>{label}</span></div>
      </div>)}
    </section>

    <div className="overview-grid">
      <section className="card availability-card">
        <div className="panel-heading">
          <div><h2>Campus availability</h2><p className="muted small">Based on manually reported parking activity.</p></div>
          <button className="text-action" onClick={onMap}>Open map <ArrowRight size={16} aria-hidden="true" /></button>
        </div>
        {zones ? <ul className="availability-list">
          {categories.map((category) => {
            const rows = zones.filter((zone) => zone.category === category);
            const available = rows.reduce((sum, zone) => sum + zone.available, 0);
            const total = rows.reduce((sum, zone) => sum + zone.inventory, 0);
            const { label, color } = categoryDisplay[category];
            const Icon = category === "bicycles" ? Bike : category === "cars" ? CarFront : SquareParking;
            return <li key={category}>
              <span className="category-icon" style={{ color }}><Icon size={17} aria-hidden="true" /></span>
              <div className="availability-row">
                <div><span>{label}</span><span className="muted small"><strong>{available}</strong> of {total} open</span></div>
                <progress max={Math.max(total, 1)} value={available} aria-label={label + " availability"} />
              </div>
            </li>;
          })}
        </ul> : <p className="muted">Waiting for parking availability.</p>}
      </section>

      <div className="dashboard-secondary">
        <section className="card">
          <div className="panel-heading"><h2>Active parking</h2>
            <button className="text-action" onClick={onSessions}>{active.length ? "Manage active parking" : "View sessions"}
              <ArrowRight size={16} aria-hidden="true" />
            </button></div>
          {active.length ? active.map((session) => <div className="dashboard-record" key={session.id}>
            <span className="feature-icon"><MapPin size={18} aria-hidden="true" /></span>
            <div><h3>{session.zone_name}</h3><p className="small muted">{session.code} · {session.plate ?? session.kind}</p></div>
          </div>) : <div className="dashboard-record">
            <span className="feature-icon" data-tone="blue"><History size={18} aria-hidden="true" /></span>
            <p className="small muted">{zones ? "No active sessions. Your current parking space will appear here." : "Loading your parking sessions…"}</p>
          </div>}
        </section>
        <section className="card">
          <div className="panel-heading"><h2>Recent notices</h2>
            <button className="text-action" onClick={onNotices}>View notices <ArrowRight size={16} aria-hidden="true" /></button></div>
          {notices.length ? notices.slice(0, 3).map((notice) => <article className="dashboard-record" key={notice.id}>
            <span className="feature-icon" data-tone="sand"><Bell size={17} aria-hidden="true" /></span>
            <div><h3>{notice.title}</h3><p className="small muted">{campusTime(notice.published_at)}</p></div>
          </article>) : <div className="dashboard-record">
            <span className="feature-icon" data-tone="sand"><Bell size={17} aria-hidden="true" /></span>
            <p className="small muted">{zones ? "No current notices." : "Loading campus notices…"}</p>
          </div>}
        </section>
      </div>
    </div>
  </div>;
}
```

### `src/components/parking-app.tsx`

<!-- file: src/components/parking-app.tsx -->

```tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowRight, Bell, CarFront, Compass, History, House, LogOut, Map as MapIcon, MapPin, Search, Shield, SquareParking, UserRound } from "lucide-react";
import { api, campusTime, mutation } from "@/lib/api";
import { signOutAndRedirect } from "@/lib/supabase-browser";
import { campusDirectionsUrl, categories, categoryDisplay, kinds, type Campus, type Category, type MapFocus, type Notice, type Profile, type Rule, type Session,
  type Space, type Vehicle, type Zone } from "@/lib/contracts";
import { campusFocus, rankEligibleSpaces, zoneFocus, zoneStatus } from "@/lib/map-geometry";
import { MapView } from "./map-view";
import { ParkingOverview } from "./parking-overview";
import { SiteBrand } from "./site-brand";
import { Staff } from "./staff";
import { useParkingUpdates } from "./realtime";
import { useParkingMotion } from "@/lib/use-parking-motion";

type Tab = "Home" | "Map" | "Find Parking" | "My Parking" | "Profile" | "Notices" | "Operations";
type Home = { vehicles: Vehicle[]; sessions: (Session & { vehicle_id: string; space_id: string })[]; notices: Notice[]; rules: Rule[] };
type HomeResponse = Home & { profile: Profile };
type Snapshot = { zones: Zone[]; spaces: Space[]; syncedAt: string };
const empty: Home = { vehicles: [], sessions: [], notices: [], rules: [] };
const tabs = [
  { name: "Home", icon: House },
  { name: "Map", icon: MapIcon },
  { name: "Find Parking", icon: Search },
  { name: "My Parking", icon: History },
  { name: "Notices", icon: Bell },
  { name: "Profile", icon: UserRound },
  { name: "Operations", icon: Shield },
] as const;
const fields = (form: HTMLFormElement) => Object.fromEntries(new FormData(form));

function canOpenOperations(profile: Profile) {
  return profile.verified && (profile.role === "admin" || profile.role === "officer");
}

function status(space: Space, vehicle: string, syncedVehicle: string | null) {
  if (space.occupied) return "Occupied";
  if (!space.available) return space.state === "open" ? "Zone unavailable" : space.state.replace("_", " ");
  if (!vehicle) return "Available";
  if (syncedVehicle !== vehicle) return "Checking vehicle eligibility";
  return space.eligible ? "Available for your vehicle" : "Restricted for your vehicle";
}

export function ParkingApp({ initialProfile, demo }: { initialProfile: Profile; demo: boolean }) {
  const [profile, setProfile] = useState(initialProfile);
  const [tab, setTab] = useState<Tab>("Home");
  const mainPanel = useParkingMotion<HTMLElement>(
    ".board-head, .board-ledger, .overview-grid > .card, .dashboard-secondary > .card, .page-intro, .panel-grid > .card, .map-tools > button, .mobile-sheet > .actions, .find-panel > h2, .app-main > .card > h2",
    tab,
  );
  const [home, setHome] = useState<Home>(empty);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [campus, setCampus] = useState<Campus>();
  const [campusError, setCampusError] = useState(false);
  const [mapAttempt, setMapAttempt] = useState(0);
  const [vehicleChoice, setVehicleChoice] = useState<string | null>(null);
  const [zoneId, setZoneId] = useState("");
  const [spaceId, setSpaceId] = useState("");
  const details = useParkingMotion<HTMLElement>("h2, .zone-metrics > span, .record > strong", [tab, zoneId, spaceId].join("/"));
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const [visibleCategories, setVisibleCategories] = useState<readonly Category[]>(categories);
  const [search, setSearch] = useState("");
  const [originId, setOriginId] = useState("main-gate");
  const [sort, setSort] = useState("distance");
  const [online, setOnline] = useState(true);
  const [syncProblem, setSyncProblem] = useState(true);
  const [syncedVehicle, setSyncedVehicle] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const previousNotices = useRef<Set<string> | null>(null);
  const [newNoticeId, setNewNoticeId] = useState("");
  const submitting = useRef(false);
  const request = useRef<AbortController | null>(null);
  const keys = useRef(new Map<string, string>());
  const vehicle = vehicleChoice === "" ? "" : home.vehicles.find((row) => row.id === vehicleChoice)?.id ?? home.vehicles[0]?.id ?? "";

  const refresh = useCallback(async () => {
    request.current?.abort();
    if (!navigator.onLine) return;
    const current = new AbortController();
    request.current = current;
    try {
      const options = { signal: current.signal };
      const [data, currentMap] = await Promise.all([
        api<HomeResponse>("home", options),
        api<Snapshot>("campus" + (vehicle ? "?vehicle=" + encodeURIComponent(vehicle) : ""), options),
      ]);
      if (current.signal.aborted || !navigator.onLine) return;
      const previous = previousNotices.current;
      const added = previous && data.notices.find((notice) => !notice.read_at && !previous.has(notice.id));
      if (added) setNewNoticeId(added.id);
      previousNotices.current = new Set(data.notices.map((notice) => notice.id));
      setHome(data);
      setProfile(data.profile);
      if (!canOpenOperations(data.profile))
        setTab((currentTab) => currentTab === "Operations" ? "Home" : currentTab);
      setSnapshot(currentMap);
      setSyncedVehicle(vehicle);
      setSyncProblem(false);
    } catch {
      if (!current.signal.aborted) setSyncProblem(true);
    }
  }, [vehicle]);

  const latestRefresh = useRef(refresh);
  useEffect(() => {
    latestRefresh.current = refresh;
    void refresh();
    return () => request.current?.abort();
  }, [refresh]);

  useEffect(() => {
    if (campus) return;
    const controller = new AbortController();
    setCampusError(false);
    void fetch("/campus.json", { signal: controller.signal }).then((result) => {
      if (!result.ok) throw new Error("Campus assets unavailable");
      return result.json() as Promise<Campus>;
    }).then(setCampus).catch(() => { if (!controller.signal.aborted) setCampusError(true); });
    return () => controller.abort();
  }, [campus, online, mapAttempt]);
  const network = useCallback((connected: boolean) => {
    request.current?.abort();
    setOnline(connected);
    setSyncProblem(true);
  }, []);
  useParkingUpdates(() => void refresh(), network);

  const zones = snapshot?.zones ?? [];
  const spaces = snapshot?.spaces ?? [];
  const selectedZone = zones.find((zone) => zone.id === zoneId);
  const selectedSpace = spaces.find((space) => space.id === spaceId && space.zone_id === zoneId);
  const staff = canOpenOperations(profile);
  const writes = online && !busy;
  const canClaim = writes && !syncProblem && syncedVehicle === vehicle && profile.verified;
  const active = home.sessions.filter((session) => !session.ended_at);
  const mySelectedSpot = active.find((session) => session.space_id === spaceId);
  const parkedVehicles = new Set(active.map((session) => session.vehicle_id));
  const spaceStatus = (space: Space) => status(space, vehicle, syncedVehicle);
  const chooseZone = useCallback((id: string) => {
    const zone = snapshot?.zones.find((row) => row.id === id);
    if (!zone) return;
    setZoneId(id);
    setSpaceId("");
    setFocus(zoneFocus(zone.geometry));
  }, [snapshot]);
  const chooseSpace = useCallback((id: string) => {
    const space = snapshot?.spaces.find((row) => row.id === id);
    if (!space) return;
    setZoneId(space.zone_id);
    setSpaceId(id);
    setFocus({ point: [space.x, space.y], size: [42, 42] });
  }, [snapshot]);
  const deselect = useCallback(() => {
    setZoneId("");
    setSpaceId("");
  }, []);
  function focusMap(target: MapFocus | null) {
    deselect();
    setFocus(target);
  }
  function overview() {
    focusMap(campus ? campusFocus(campus.size) : null);
  }
  function filterCategories(next: readonly Category[]) {
    setVisibleCategories(next);
    if (selectedZone && !next.includes(selectedZone.category)) overview();
  }
  const filter = visibleCategories.length === categories.length ? "" : visibleCategories.length === 1 ? visibleCategories[0] : "custom";
  const visibleZones = zones.filter((zone) => visibleCategories.includes(zone.category));
  const term = search.trim().toLowerCase();
  const matchingZones = visibleZones.filter((zone) => (zone.name + " " + zone.code).toLowerCase().includes(term));
  const matchingBuildings = term ? campus?.buildings.filter(([name]) => name.toLowerCase().includes(term)).slice(0, 6) : [];
  const matchingRoads = term ? campus?.roads.filter(([name]) => name.toLowerCase().includes(term)).slice(0, 6) : [];
  const choices = useMemo(() => {
    if (!snapshot || syncedVehicle !== vehicle) return [];
    const origin = campus?.origins.find((entry) => entry.id === originId);
    return rankEligibleSpaces(snapshot.spaces, origin, sort === "availability");
  }, [snapshot, campus, originId, sort, syncedVehicle, vehicle]);

  async function run(task: () => Promise<unknown>, confirmation: string) {
    if (submitting.current || !navigator.onLine) return;
    submitting.current = true;
    setBusy(true);
    setMessage("");
    try { await task(); setMessage(confirmation); }
    catch (error) {
      setMessage(error instanceof Error ? error.message : "The action failed.");
    } finally {
      setSyncProblem(true);
      await latestRefresh.current();
      submitting.current = false;
      setBusy(false);
    }
  }
  async function withKey(action: string, path: string, body: unknown) {
    const key = keys.current.get(action) ?? crypto.randomUUID();
    keys.current.set(action, key);
    await api(path, mutation(body, "POST", key));
    keys.current.delete(action);
  }
  function goToTab(next: Tab) {
    setTab(next);
    if (next === "Notices") setNewNoticeId("");
    window.scrollTo(0, 0);
  }
  async function signOut() {
    setMessage(await signOutAndRedirect("/"));
  }
  function showOnMap(id: string) {
    setVisibleCategories(categories);
    setSearch("");
    chooseSpace(id);
    goToTab("Map");
  }
  function findNearest() {
    const gate = campus?.origins.find((origin) => origin.id === "main-gate");
    if (!gate || !canClaim || !vehicle) return;
    const [nearest] = rankEligibleSpaces(spaces, gate);
    if (!nearest) { setMessage("No eligible spaces are currently open for this vehicle."); return; }
    showOnMap(nearest.id);
    setMessage("Nearest eligible space to the main entrance: " + nearest.code);
  }
  function showMySpot() {
    const session = active.find((item) => item.vehicle_id === vehicle) ?? (active.length === 1 ? active[0] : undefined);
    if (session) showOnMap(session.space_id);
    else goToTab("My Parking");
  }
  function endSession(id: string) {
    return run(() => withKey("end:" + id, "sessions/" + id + "/end", {}), "Parking session ended.");
  }
  async function sendReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedZone) return;
    const form = event.currentTarget;
    const data = fields(form);
    await run(async () => {
      await api("reports", mutation({ ...data, zoneId: selectedZone.id, spaceId: selectedSpace?.id ?? null }));
      form.reset();
    }, "Report sent to parking staff.");
  }

  const initials = profile.name.trim().split(/\s+/).slice(0, 2).map((word) => Array.from(word)[0]).join("").toUpperCase();
  const unread = home.notices.filter((notice) => !notice.read_at).length;
  const newNotice = home.notices.find((notice) => notice.id === newNoticeId && !notice.read_at);

  return <div className="app-layout">
    <aside className="side-rail">
      <div className="rail-brand"><SiteBrand /></div>
      <nav className="app-nav" aria-label="Parking application">
        {tabs.filter(({ name }) => name !== "Operations" || staff).map(({ name, icon: Icon }) => <button key={name}
          aria-pressed={name === tab} aria-label={name} aria-description={name === "Notices" && unread ? unread + " unread notices" : undefined}
          onClick={() => goToTab(name)}>
          <span className="nav-icon"><Icon size={20} aria-hidden="true" />{name === "Notices" && unread > 0 && <span className="unread-count" aria-hidden="true">{unread}</span>}</span>
          <span className={name === "Operations" ? "operations-label" : undefined}>{name}</span>
          {name === "Operations" && <span className="operations-short">Ops</span>}
        </button>)}
      </nav>
      <div className="rail-footer">
        <div className="rail-user"><span className="user-avatar" aria-hidden="true">{initials || "U"}</span>
          <div><strong>{profile.name}</strong><span>{profile.role}</span></div></div>
        <button className="rail-sign-out" onClick={() => void signOut()}><LogOut size={17} aria-hidden="true" /> Sign out</button>
      </div>
    </aside>

    <main ref={mainPanel} className="shell app-main">
      <header className="app-head">
        <div className="mobile-brand"><SiteBrand /></div>
        <div className="app-location"><MapPin size={17} aria-hidden="true" /> University of Moratuwa</div>
        <div className="app-sync" role="status">
          <span className="sync-dot" data-state={!online ? "offline" : syncProblem ? "waiting" : "updated"} />
          <div>
            <strong>{!online ? "Offline. Parking changes are paused." :
              syncProblem ? snapshot ? "Availability may be out of date." : "Checking availability…" : "Availability updated"}</strong>
            {snapshot && <time dateTime={snapshot.syncedAt}>Last refreshed {campusTime(snapshot.syncedAt)}</time>}
          </div>
        </div>
        <div className="app-head-actions">
          {demo && <span className="demo-label" title="Student project">Demo data</span>}
          <button className="mobile-sign-out" aria-label="Sign out" onClick={() => void signOut()}><LogOut size={18} aria-hidden="true" /></button>
        </div>
      </header>
      {online && syncProblem && <div className="app-alert"><button disabled={busy} onClick={() => void refresh()}>Refresh availability</button></div>}
      {!profile.verified && <p className="app-alert">Your campus role is waiting for administrator verification.</p>}
      {message && <p className="app-alert" role="status">{message}</p>}
      {tab !== "Notices" && newNotice && <div className="app-alert" role="status">New notice · {newNotice.title}{" "}
        <button className="text-action" onClick={() => goToTab("Notices")}>View notices</button></div>}

      {tab === "Home" ? <ParkingOverview name={profile.name} zones={snapshot?.zones} vehicleCount={home.vehicles.length}
        active={active} notices={home.notices} onFind={() => goToTab("Find Parking")} onMap={() => goToTab("Map")}
        onSessions={() => goToTab("My Parking")} onNotices={() => goToTab("Notices")} /> : <div className="page-intro">
        <h1>{tab === "Map" ? "Campus map" : tab}</h1>
        {(tab === "Map" || tab === "Find Parking") && <label className="vehicle-picker">
          <span><CarFront size={18} aria-hidden="true" /> Selected vehicle</span>
          <select value={vehicle} disabled={busy} onChange={(event) => setVehicleChoice(event.target.value)}>
            <option value="">Select a vehicle</option>{home.vehicles.map((row) =>
              <option key={row.id} value={row.id}>{row.plate || row.model || row.kind} · {row.kind}</option>)}
          </select>
        </label>}
      </div>}

      {tab === "Map" && <section className="map-grid">
        {campus ? <MapView campus={campus} zones={visibleZones} spaces={spaces} selected={zoneId} selectedSpace={spaceId} focus={focus}
          onZone={chooseZone} onSpace={chooseSpace} onOverview={overview} onDeselect={deselect} /> :
          <div className="card" role="status">{campusError ? <>
            <p>Campus map assets could not load. You can still use the zone list.</p>
            <button disabled={!online} onClick={() => setMapAttempt((attempt) => attempt + 1)}>Retry campus map</button>
          </> : online ? "Loading campus…" : "Reconnect to load the campus map."}</div>}
        <div className="card mobile-sheet stack">
          <div className="actions">
            <button disabled={!vehicle || !canClaim || !campus} onClick={findNearest}>Nearest free</button>
            {active.length > 0 && <button onClick={showMySpot}>My spot</button>}
          </div>
          {selectedZone && <section ref={details} className="stack" aria-label="Selected parking zone">
            <div className="actions">
              <span className="tag" style={{ borderLeft: "5px solid " + categoryDisplay[selectedZone.category].color }}>
                {selectedZone.code} · {categoryDisplay[selectedZone.category].label}
              </span>
              {!selectedZone.open && <span className="tag">Closed</span>}
            </div>
            <h2>{selectedZone.name}</h2><p>{selectedZone.instructions}</p>
            <p className="small">Zone status · {zoneStatus(selectedZone).label}</p>
            <div className="zone-metrics">
              <span><strong>{selectedZone.available}</strong> Available</span>
              <span><strong>{selectedZone.occupied}</strong> Occupied</span>
              <span><strong>{selectedZone.proposed_capacity}</strong> Planned</span>
            </div>
            <label>Parking space<select value={spaceId} onChange={(event) => {
              if (event.target.value) chooseSpace(event.target.value);
              else chooseZone(selectedZone.id);
            }}>
              <option value="">Select a space</option>
              {spaces.filter((space) => space.zone_id === zoneId).map((space) =>
                <option key={space.id} value={space.id}>{space.code} · {spaceStatus(space)}</option>)}
            </select></label>
            {selectedSpace && <div className="record"><strong role="status">{selectedSpace.code} · {spaceStatus(selectedSpace)}</strong>
              <p className="small">Status updated {campusTime(selectedSpace.updated_at)}</p>
              {parkedVehicles.has(vehicle) && <p>This vehicle has an active session in My Parking.</p>}
              {mySelectedSpot ? <button className="primary" disabled={!writes || !profile.verified}
                onClick={() => void endSession(mySelectedSpot.id)}>I’ve left</button> :
              <button className="primary" disabled={!canClaim || !vehicle || parkedVehicles.has(vehicle) || !selectedSpace.eligible || !selectedSpace.available}
                onClick={() => void run(() => withKey("claim:" + vehicle + selectedSpace.id, "sessions",
                  { vehicleId: vehicle, spaceId: selectedSpace.id }), "Parking session started.")}>I’ve parked here</button>}
            </div>}
            <details><summary>Report a problem</summary><form onSubmit={sendReport}>
              <label>Problem<select name="kind"><option value="incorrect">Incorrect status</option><option value="blocked">Blocked space</option>
                <option value="unauthorized">Unauthorized parking</option><option value="wrong_category">Wrong vehicle category</option></select></label>
              <label>Details<textarea name="description" minLength={3} maxLength={800} required /></label>
              <button disabled={!writes || !profile.verified}>Send report</button>
            </form></details>
          </section>}
          <label>Search campus<span className="search-field"><Search size={17} aria-hidden="true" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Zone, building, or road" /></span></label>
          {matchingBuildings?.length ? <div className="actions" role="group" aria-label="Matching buildings">
            {matchingBuildings.map(([name, x, y, width, height]) => <button key={name} onClick={() => focusMap({
              point: [x + width / 2, y + height / 2], size: [Math.max(82, width), Math.max(82, height)],
            })}>{name}</button>)}
          </div> : null}
          {matchingRoads?.length ? <div className="actions" role="group" aria-label="Matching roads">
            {matchingRoads.map(([name, w, points]) => <button key={name} onClick={() => focusMap(zoneFocus({
              type: "strip", points, w,
            }))}>{name}</button>)}
          </div> : null}
          {campus && <details><summary>Road directory ({campus.roads.length})</summary>
            <div className="actions" role="group" aria-label="Road directory">{campus.roads.map(([name, w, points]) =>
              <button key={name} onClick={() => focusMap(zoneFocus({ type: "strip", points, w }))}>{name}</button>)}</div>
          </details>}
          <label>Parking category<select value={filter} onChange={(event) => filterCategories(event.target.value ? [event.target.value as Category] : categories)}>
            <option value="">All categories</option>{filter === "custom" && <option disabled value="custom">Custom selection</option>}{categories.map((category) =>
              <option value={category} key={category}>{categoryDisplay[category].label}</option>)}
          </select></label>
          <div className="zone-list" role="group" aria-label="Parking zones">{matchingZones.map((zone) => <button key={zone.id}
            aria-pressed={zone.id === zoneId} onClick={() => chooseZone(zone.id)}><span>{zone.code} · {zone.name}</span>
            <span className="zone-open" data-available={zone.open && zone.available > 0}>{zone.open ? zone.available + " open" : "Closed"}</span></button>)}</div>
          <details><summary>Map legend</summary>
            <p className="small muted">Green pins have spaces available. Amber means fewer than 40% are open. Red means full. Gray marks closed or unavailable zones.</p>
            {categories.map((category) => {
              const group = zones.filter((zone) => zone.category === category);
              const occupied = group.reduce((sum, zone) => sum + zone.occupied, 0);
              const inventory = group.reduce((sum, zone) => sum + zone.inventory, 0);
              return <label className="check" key={category}><input type="checkbox" checked={visibleCategories.includes(category)}
                onChange={(event) => filterCategories(event.target.checked ? [...visibleCategories, category] : visibleCategories.filter((item) => item !== category))} />
                <span style={{ borderLeft: "4px solid " + categoryDisplay[category].color, paddingLeft: ".5rem" }}>
                  {categoryDisplay[category].label} · {occupied} / {inventory} occupied
                  <progress className="legend-meter" aria-label={categoryDisplay[category].label + " occupancy"}
                    value={occupied} max={Math.max(1, inventory)} /></span></label>;
            })}
          </details>
          <a className="text-action campus-directions" href={campusDirectionsUrl} referrerPolicy="no-referrer"><Compass size={17} aria-hidden="true" /> Campus directions (Google Maps)</a>
        </div>
      </section>}

      {tab === "Find Parking" && <section className="card stack find-panel">
        <h2>Eligible spaces</h2>
        <div className="find-filters">
          <label>Starting point<select value={originId} onChange={(event) => setOriginId(event.target.value)}>
            {campus?.origins.map((origin) => <option key={origin.id} value={origin.id}>{origin.name}</option>)}
          </select></label>
          <label>Sort by<select value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="distance">Approximate distance</option><option value="availability">Most eligible spaces</option>
          </select></label>
        </div>
        <p className="muted">Distances use the schematic campus map. A space may be taken before you arrive.</p>
        {!vehicle ? <div className="empty-state"><span className="feature-icon"><CarFront size={22} aria-hidden="true" /></span>
          <p>Register or select a vehicle to see eligible spaces.</p>
          <button className="text-action" onClick={() => goToTab("Profile")}>Manage vehicles <ArrowRight size={16} aria-hidden="true" /></button>
        </div> :
          syncedVehicle !== vehicle ? <p role="status">Checking which spaces match your vehicle…</p> :
          choices.length ? choices.slice(0, 30).map((space) =>
            <div className="result-row" key={space.id}><span className="feature-icon"><MapPin size={18} aria-hidden="true" /></span>
              <div><h3>{space.zone_name}</h3><p className="small muted">{space.code}</p></div>
              <button onClick={() => showOnMap(space.id)}>Show on map <ArrowRight size={16} aria-hidden="true" /></button></div>) :
            <p>No eligible open spaces currently match this vehicle.</p>}
      </section>}

      {tab === "My Parking" && <section className="card stack"><h2>Parking sessions</h2>
        {!home.sessions.length && <div className="empty-state"><span className="feature-icon"><History size={22} aria-hidden="true" /></span>
          <p>No parking sessions yet.</p><button className="text-action" onClick={() => goToTab("Find Parking")}>
            Find parking <ArrowRight size={16} aria-hidden="true" /></button></div>}
        {home.sessions.map((session) => <div className="result-row" key={session.id}>
          <span className="feature-icon" data-tone={session.ended_at ? "blue" : "green"}><SquareParking size={18} aria-hidden="true" /></span>
          <div><h3>{session.code} · {session.zone_name}</h3>
            <p className="small muted">{session.plate ?? session.kind} · Parked {campusTime(session.started_at)}</p>
            {session.ended_at && <p className="small muted">Left {campusTime(session.ended_at)}</p>}
          </div>
          {!session.ended_at && <div className="actions">
            <button onClick={() => showOnMap(session.space_id)}>Show my spot</button>
            <button className="primary" disabled={!writes || !profile.verified} onClick={() => void endSession(session.id)}>I’ve left</button></div>}
        </div>)}
      </section>}

      {tab === "Profile" && <section className="panel-grid">
        <div className="card"><h2>Account details</h2><p className="account-role">{profile.role} · {profile.verified ? "Verified" : "Pending verification"}</p>
          <form onSubmit={(event) => {
            event.preventDefault();
            const data = fields(event.currentTarget);
            void run(async () => setProfile(await api<Profile>("profile", mutation(data, "PATCH"))), "Profile updated.");
          }}><label>Name<input name="name" defaultValue={profile.name} required maxLength={100} /></label>
            <button className="primary" disabled={!writes}>Save name</button></form>
        </div>
        <div className="card stack"><h2>Vehicles</h2>
          <VehicleForm disabled={!writes || !profile.verified} submit={(value) =>
            run(() => api("vehicles", mutation(value)), "Vehicle registered.")} />
          {home.vehicles.map((row) => <details className="record" key={row.id}>
            <summary>{row.plate || row.model || "Bicycle"} · {row.kind}</summary>
            {parkedVehicles.has(row.id) && <p>End this vehicle’s active session before editing or archiving it.</p>}
            <VehicleForm item={row} disabled={!writes || !profile.verified || parkedVehicles.has(row.id)} submit={(value) =>
              run(() => api("vehicles/" + row.id, mutation(value, "PATCH")), "Vehicle updated.")} />
            <button disabled={!writes || !profile.verified || parkedVehicles.has(row.id)} onClick={() => void run(() =>
              api("vehicles/" + row.id, { method: "DELETE" }), "Vehicle archived.")}>Archive vehicle</button>
          </details>)}
        </div>
      </section>}

      {tab === "Notices" && <section className="panel-grid">
        <div className="card"><h2>Campus notices</h2>{!home.notices.length && <p className="muted">No current notices.</p>}
          {home.notices.map((notice) => <article className="record" key={notice.id}><h3>{notice.title}</h3>
            <p>{notice.body}</p><p className="small">{campusTime(notice.published_at)}</p>
            {!notice.read_at && <button disabled={!writes} onClick={() => void run(() =>
              api("notifications/" + notice.id + "/read", mutation({})), "Marked as read.")}>Mark as read</button>}
          </article>)}</div>
        <div className="card"><h2>Parking rules</h2>{!home.rules.length && <p>No published rules.</p>}
          {home.rules.map((rule) => <article className="record" key={rule.id}><h3>{rule.title}</h3><p>{rule.body}</p></article>)}</div>
      </section>}

      {tab === "Operations" && staff && <Staff key={profile.role} admin={profile.role === "admin"} online={online}
        liveAt={snapshot?.syncedAt} onChanged={() => void refresh()} />}
    </main>
  </div>;
}

function VehicleForm({ item, disabled, submit }: {
  item?: Vehicle; disabled: boolean; submit: (value: unknown) => Promise<void>;
}) {
  return <form onSubmit={(event) => { event.preventDefault(); if (!disabled) void submit(fields(event.currentTarget)); }}>
    <label>Vehicle type<select name="kind" defaultValue={item?.kind ?? "car"}>
      {kinds.map((kind) => <option key={kind}>{kind}</option>)}</select></label>
    <label>Registration number<input name="plate" defaultValue={item?.plate ?? ""} maxLength={25} /></label>
    <label>Model or bicycle label<input name="model" defaultValue={item?.model ?? ""} maxLength={100} /></label>
    <label>Color<input name="color" defaultValue={item?.color ?? ""} maxLength={40} /></label>
    <button disabled={disabled}>{item ? "Save changes" : "Register vehicle"}</button>
  </form>;
}
```
