# Phase 5. Security officer and administrator operations

## Roles and permissions

The app stores six account roles and derives three permission levels. The server enforces permissions in the API and rechecks the actor on protected transactions. Parking eligibility is checked separately for the selected vehicle and zone.

| Permission level | Account roles | Scope |
| --- | --- | --- |
| Driver | Student (`student`), Lecturer (`lecturer`), University Staff (`staff`), Visitor (`visitor`) | Own vehicles and sessions, eligible-space search, rules, notices, and issue reports. Zone rules may differ by account role. |
| Security Officer | Security Officer (`officer`) | Driver access plus parking monitoring, space verification and blocking, incident review, and session corrections with a reason. |
| Administrator | Administrator (`admin`) | Driver and officer access plus account approvals, role assignment, suspensions, zones, eligibility, closures, notices, analytics, and the audit log. |

Administrators assign privileged roles after verifying the person's duties. Pilot officers and administrators complete TOTP. Suspension blocks protected pages and APIs. Officers can review and correct any active sessions left by a suspended account. A role change records the administrator, target account, reason, and new permissions.

- Officers search by zone or space code, review stale and active sessions, record verification, block spaces, handle incidents, and end incorrect sessions. A space closed by the administrator stays closed until an administrator changes it.
- Administrators manage roles, verifications, suspensions, user session limits, zone geometry, individual spaces, access rules, exceptions, closures, and parking policy text. Capacity follows the count of published, non-retired spaces. Zone and space edit forms detect conflicting edits. Coordinate changes are saved through forms and reflected in the shared map.
- Announcements can be drafted, published immediately to selected roles, edited, expired, or archived. The inbox checks the current audience, so newly registered and newly approved members see matching, unexpired announcements. Scheduled publishing and browser push are follow-up features.
- The zone summary and CSV show current capacity and occupancy, last 30 days of reported sessions, and average duration. Historical occupancy percentages and peak-period dashboards are follow-up features.

## Open Operations

Create and confirm the first administrator's Supabase Auth account. Set the owner connection and `BOOTSTRAP_ADMIN_EMAIL` as described in [Phase 2](02-postgresql.md#configure-postgresql), then run `npm run db:admin`. Sign in with that account and open **Operations**. New staff sign in to create their application profile before an administrator can verify affiliation and assign a role from **Accounts**.

The officer desk shows reported occupancy alongside closure status. Recording a space check verifies the active session when one exists. Administrators set the field-verification flags on zone and space inventory.

**Exit check** Sign in as an officer and confirm that an admin API request returns 403. Check that the officer desk refreshes as a driver parks or leaves. Close a zone as an admin with an active session and confirm the driver can end it, further claims are refused, and the closure appears in the audit history. Publish a visitor notice before creating a visitor test account and check that the new visitor sees it and can mark it read.

## Verification results

The production build and campus tests passed. The operations tests used Chrome at desktop and phone widths, an isolated PostgreSQL database, and local Auth and Realtime adapters. The operator script bootstrapped the test administrator.

- The officer received `403` on administrator endpoints. The desk refreshed after a driver parked and left, recorded session verification, and resolved a driver report.
- A closure preserved the driver's ability to leave and blocked a new claim. The audit showed the zone code, closure state, and reason. Reopening and edited coordinates reached the shared campus snapshot. Stale edits and invalid geometry were rejected.
- A visitor who registered after publication could see the targeted notice and mark it read. Role rules, temporary grants, parking rules, account approvals, suspensions, officer corrections, and the administrator CSV download passed.

The hosted demo has no active administrator. Hosted Operations testing requires the first confirmed administrator account to be bootstrapped.

## Complete source files

### `src/server/staff-route.ts`

<!-- file: src/server/staff-route.ts -->

```ts
import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { categories, kinds, roles, states, type Report, type Session } from "@/lib/contracts";
import { database, type Transaction } from "./db";
import { reason, text, uuid, release } from "./driver";
import { ApiError, response } from "./errors";
import { lockActor, requireAccess, type Viewer } from "./viewer";

const missing = () => new ApiError(404, "NOT_FOUND", "The requested record was not found.");
const conflict = (message: string) => new ApiError(409, "CONFLICT", message);
const number = (min: number, max: number) => z.number().min(min).max(max);
const point = z.tuple([number(-200,1300), number(-200,1000)]);
const geometry = z.discriminatedUnion("type", [
  z.object({ type: z.literal("box"), x: number(-200,1300), y: number(-200,1000),
    w: number(1,600), h: number(1,600), r: number(-360,360) }),
  z.object({ type: z.literal("strip"), points: z.array(point).min(2).max(100), w: number(1,100) }),
  z.object({ type: z.literal("polygon"), points: z.array(point).min(3).max(100) }),
]).refine((shape) => {
  if (shape.type === "box") return true;
  if (shape.type === "strip") return shape.points.some(([x,y]) => x !== shape.points[0][0] || y !== shape.points[0][1]);
  const area = shape.points.reduce((sum, [x,y], index) => {
    const [nextX,nextY] = shape.points[(index + 1) % shape.points.length];
    return sum + x * nextY - y * nextX;
  }, 0);
  return Math.abs(area) > 1e-6;
}, { message: "Zone geometry must cover a nonzero length or area." });
const audit = (tx: Transaction, user: Viewer, action: string, id: string, why: string,
  zone: string | null = null, details: Record<string, string | number | boolean> = {}) =>
  tx`insert into app.activity(actor,action,target,zone_id,reason,details)
    values (${user.id},${action},${id},${zone},${why},${tx.json(details)})`;

async function operations(query: string) {
  const stale = Number(process.env.STALE_SESSION_HOURS ?? 24);
  const hours = Number.isInteger(stale) && stale > 0 && stale <= 720 ? stale : 24;
  const cleaned = query.trim().slice(0, 50).toUpperCase();
  return database().begin("isolation level repeatable read read only", async (tx) => {
    const [sessions, reports, spaces] = await Promise.all([
      tx<Session[]>`select q.id,q.started_at,q.ended_at,s.code,z.name as zone_name,v.kind,v.plate,
        p.name as user_name,q.verified_at,(q.started_at<now()-make_interval(hours=>${hours})) as stale
        from app.sessions q join app.spaces s on s.id=q.space_id join app.zones z on z.id=s.zone_id
        join app.vehicles v on v.id=q.vehicle_id join app.profiles p on p.id=q.user_id
        where q.ended_at is null and position(${cleaned} in s.code)>0
        order by stale desc,q.started_at limit 100`,
      tx<Report[]>`select r.id,r.kind,r.description,r.status,z.code as zone,s.code as space,r.resolution
        from app.reports r join app.zones z on z.id=r.zone_id left join app.spaces s on s.id=r.space_id
        where position(${cleaned} in coalesce(s.code,z.code))>0
        order by (r.status='open') desc,r.created_at desc limit 100`,
      tx`select s.id,s.code,s.state,s.published,z.open and z.published as zone_open,q.id is not null as occupied
        from app.spaces s join app.zones z on z.id=s.zone_id
        left join app.sessions q on q.space_id=s.id and q.ended_at is null
        where position(${cleaned} in s.code)>0 and s.state<>'retired' and s.published
        order by s.code limit 40`,
    ]);
    return { sessions, reports, spaces };
  });
}

async function zoneSave(user: Viewer, input: unknown, id?: string) {
  const item = z.object({
    code: z.string().regex(/^Z[0-9]{2,5}$/), name: text(100), category: z.enum(categories),
    proposed_capacity: z.number().int().min(0).max(500), geometry,
    instructions: z.string().trim().max(1000), open: z.boolean(), published: z.boolean(),
    verified: z.boolean(), version: z.number().int().min(0), reason,
  }).parse(input);
  return database().begin(async (tx) => {
    await lockActor(tx, user, "admin");
    let zoneId = id;
    if (zoneId) {
      const [old] = await tx`select code,version from app.zones where id=${zoneId} for no key update`;
      if (!old) throw missing();
      if (old.version !== item.version) throw conflict("The zone changed. Reload and try again.");
      if (old.code !== item.code) throw conflict("A published zone code is permanent.");
      if (!item.published && (await tx`select 1 from app.sessions q join app.spaces s on s.id=q.space_id
        where s.zone_id=${zoneId} and q.ended_at is null limit 1`).length)
        throw conflict("End active sessions before unpublishing a zone.");
      await tx`update app.zones set name=${item.name},category=${item.category},
        proposed_capacity=${item.proposed_capacity},geometry=${tx.json(item.geometry)},instructions=${item.instructions},
        open=${item.open},published=${item.published},verified=${item.verified},
        version=version+1,updated_at=clock_timestamp() where id=${zoneId}`;
    } else {
      [{ id: zoneId }] = await tx<{ id: string }[]>`insert into app.zones(code,name,category,proposed_capacity,geometry,instructions,open,published,verified)
        values (${item.code},${item.name},${item.category},${item.proposed_capacity},${tx.json(item.geometry)},
          ${item.instructions},${item.open},${item.published},${item.verified}) returning id`;
    }
    await audit(tx, user, "zone.save", zoneId, item.reason, zoneId, {
      state: item.open ? "open" : "closed", published: item.published, verified: item.verified,
    });
    return { id: zoneId };
  });
}

async function spaceSave(user: Viewer, input: unknown, id?: string) {
  const item = z.object({
    zone_id: uuid, code: z.string().regex(/^Z[0-9]{2,5}-[0-9]{3,5}$/),
    x: number(-200,1300), y: number(-200,1000), state: z.enum(states), published: z.boolean(),
    verified: z.boolean(), version: z.number().int().min(0), reason,
  }).parse(input);
  return database().begin(async (tx) => {
    await lockActor(tx,user,"admin");
    const [zone] = await tx`select code from app.zones where id=${item.zone_id} for no key update`;
    if (!zone || !item.code.startsWith(String(zone.code) + "-")) throw conflict("Use the selected zone’s code as the space prefix.");
    let spaceId = id;
    if (spaceId) {
      const [old] = await tx`select code,version from app.spaces where id=${spaceId} and zone_id=${item.zone_id} for no key update`;
      if (!old) throw missing();
      if (old.version !== item.version || old.code !== item.code) throw conflict("Reload the latest space. Space codes are permanent.");
      if ((!item.published || item.state === "retired") && (await tx`select 1 from app.sessions
        where space_id=${spaceId} and ended_at is null`).length) throw conflict("End the active session before retiring or unpublishing a space.");
      await tx`update app.spaces set x=${item.x},y=${item.y},state=${item.state},published=${item.published},
        verified=${item.verified},version=version+1,updated_at=clock_timestamp() where id=${spaceId}`;
    } else {
      [{ id: spaceId }] = await tx<{ id: string }[]>`insert into app.spaces(zone_id,code,x,y,state,published,verified)
        values(${item.zone_id},${item.code},${item.x},${item.y},${item.state},${item.published},${item.verified}) returning id`;
    }
    await audit(tx,user,"space.save",spaceId,item.reason,item.zone_id,{
      state: item.state, published: item.published, verified: item.verified,
    });
    return { id: spaceId };
  });
}

async function accessSave(user: Viewer, input: unknown, grant: boolean) {
  const item = z.object({
    zoneId: uuid, role: z.enum(roles).optional(), userId: uuid.optional(), kind: z.enum(kinds),
    allowed: z.boolean(), expiresAt: z.iso.datetime().optional(), reason,
  }).parse(input);
  return database().begin(async (tx) => {
    await lockActor(tx,user,"admin");
    if (!(await tx`select id from app.zones where id=${item.zoneId} for no key update`).length) throw missing();
    if (grant) {
      if (!item.userId) throw new ApiError(422,"USER_REQUIRED","Select an account.");
      if (!(await tx`select id from app.profiles where id=${item.userId}`).length) throw missing();
      if (item.allowed) {
        if (!item.expiresAt || new Date(item.expiresAt).getTime() <= Date.now())
          throw new ApiError(422,"EXPIRY_REQUIRED","Enter a future expiry.");
        await tx`insert into app.access_grants(zone_id,user_id,kind,approved_by,expires_at)
          values(${item.zoneId},${item.userId},${item.kind},${user.id},${item.expiresAt})
          on conflict(zone_id,user_id,kind) do update set expires_at=excluded.expires_at,approved_by=excluded.approved_by`;
      } else await tx`delete from app.access_grants where zone_id=${item.zoneId} and user_id=${item.userId} and kind=${item.kind}`;
    } else {
      if (!item.role) throw new ApiError(422,"ROLE_REQUIRED","Select a role.");
      if (item.allowed) await tx`insert into app.access_rules values(${item.zoneId},${item.role},${item.kind}) on conflict do nothing`;
      else await tx`delete from app.access_rules where zone_id=${item.zoneId} and role=${item.role} and kind=${item.kind}`;
    }
    await audit(tx,user,grant ? "grant.save" : "rules.access",item.zoneId,item.reason,item.zoneId,
      { role: item.role ?? "", account: item.userId ?? "", kind: item.kind, allowed: item.allowed,
        ...(grant && item.allowed ? { expires_at: item.expiresAt ?? "" } : {}) });
    return { ok:true };
  });
}

async function userSave(user: Viewer, id: string, input: unknown) {
  if (user.id === id) throw conflict("Another administrator must update your own permissions.");
  const item = z.object({ role: z.enum(roles), verified: z.boolean(), suspended: z.boolean(),
    max_sessions: z.number().int().min(1).max(10), reason }).parse(input);
  return database().begin(async (tx) => {
    const rows = await tx<Viewer[]>`select * from app.profiles where id in (${user.id},${id}) order by id for no key update`;
    const actor = rows.find((row) => row.id === user.id);
    if (!actor) throw missing();
    requireAccess(actor,"admin");
    if (!rows.some((row) => row.id === id)) throw missing();
    await tx`update app.profiles set role=${item.role},verified=${item.verified},suspended=${item.suspended},
      max_sessions=${item.max_sessions} where id=${id}`;
    await audit(tx,user,"account.save",id,item.reason,null,{
      role:item.role,verified:item.verified,suspended:item.suspended,max_sessions:item.max_sessions,
    });
    return { ok:true };
  });
}

async function verify(user: Viewer, id: string, input: unknown) {
  const item = z.object({ state: z.enum(["unchanged","open","blocked","under_review"]), reason }).parse(input);
  return database().begin(async (tx) => {
    await lockActor(tx,user,"officer");
    const [record] = await tx`select zone_id from app.spaces where id=${id}`;
    if (!record) throw missing();
    const zone = String(record.zone_id);
    await tx`select id from app.zones where id=${zone} for no key update`;
    const [space] = await tx`select state from app.spaces where id=${id} and published for no key update`;
    if (!space || space.state === "retired") throw missing();
    if (item.state !== "unchanged") {
      if (space.state === "closed") throw conflict("Only an administrator can reopen a closed space.");
      await tx`update app.spaces set state=${item.state},version=version+1,updated_at=clock_timestamp() where id=${id}`;
    }
    const [session] = await tx`update app.sessions set verified_at=clock_timestamp(),verified_by=${user.id}
      where space_id=${id} and ended_at is null returning id`;
    await audit(tx,user,"space.save",id,item.reason,zone,{
      session_verified: !!session, state: item.state === "unchanged" ? String(space.state) : item.state,
    });
    return { ok:true };
  });
}

async function resolveReport(user: Viewer, id: string, input: unknown) {
  const resolution = reason.parse(z.object({ resolution: z.unknown() }).parse(input).resolution);
  return database().begin(async (tx) => {
    await lockActor(tx,user,"officer");
    const [report] = await tx<{ zone_id: string }[]>`update app.reports set status='resolved',resolution=${resolution},reviewed_by=${user.id}
      where id=${id} and status='open' returning zone_id`;
    if (!report) throw conflict("The report is unavailable or already resolved.");
    await audit(tx,user,"report.resolve",id,resolution,report.zone_id);
    return { ok:true };
  });
}

async function noticeSave(user: Viewer, input: unknown, id?: string) {
  const item = z.object({
    title: text(120), body: text(2000), audience: z.array(z.enum(roles)).max(6),
    state: z.enum(["draft","published","archived"]), expiresAt: z.iso.datetime().nullable(), reason,
  }).parse(input);
  return database().begin(async (tx) => {
    await lockActor(tx,user,"admin");
    const audience = tx.array(item.audience);
    const [existing] = id ? await tx`select published_at from app.announcements where id=${id} for no key update` : [];
    if (id && !existing) throw missing();
    const published: Date | null = existing?.published_at ?? (item.state === "published" ? new Date() : null);
    if (published && item.expiresAt && +new Date(item.expiresAt) <= +published)
      throw new ApiError(422,"INVALID_EXPIRY","Expiry must follow publication.");
    if (published && item.state === "draft") throw conflict("Archive a notice after it has been published.");
    let notice = id;
    if (notice) {
      await tx`update app.announcements set title=${item.title},body=${item.body},
        audience=${audience}::text[]::app.user_role[],state=${item.state},published_at=${published},
        expires_at=${item.expiresAt} where id=${notice}`;
    } else {
      [{ id: notice }] = await tx<{ id: string }[]>`insert into app.announcements(author,title,body,audience,state,published_at,expires_at)
        values(${user.id},${item.title},${item.body},${audience}::text[]::app.user_role[],${item.state},${published},${item.expiresAt}) returning id`;
    }
    await audit(tx,user,"announcement.save",notice,item.reason);
    return { id:notice };
  });
}

async function ruleSave(user: Viewer, input: unknown, id?: string) {
  const item = z.object({ title: text(120), body: text(2000), active: z.boolean(), reason }).parse(input);
  return database().begin(async (tx) => {
    await lockActor(tx,user,"admin");
    const [row] = id
      ? await tx`update app.parking_rules set title=${item.title},body=${item.body},active=${item.active},
          updated_at=now() where id=${id} returning id`
      : await tx`insert into app.parking_rules(title,body,active) values(${item.title},${item.body},${item.active}) returning id`;
    if (!row) throw missing();
    await audit(tx,user,"rule.save",String(row.id),item.reason);
    return row;
  });
}

async function analytics() {
  return database()`select z.code,z.name,z.category,
    (select count(*)::int from app.spaces s where s.zone_id=z.id and s.published and s.state<>'retired') as inventory,
    (select count(*)::int from app.sessions q join app.spaces s on s.id=q.space_id
      where s.zone_id=z.id and q.ended_at is null) as occupied,
    (select count(*)::int from app.sessions q join app.spaces s on s.id=q.space_id
      where s.zone_id=z.id and q.started_at>=now()-interval '30 days') as sessions_30d,
    (select coalesce(round(avg(extract(epoch from (q.ended_at-q.started_at))/60)),0)::int
      from app.sessions q join app.spaces s on s.id=q.space_id
      where s.zone_id=z.id and q.ended_at is not null and q.started_at>=now()-interval '30 days') as average_minutes_30d
    from app.zones z where z.published order by z.code`;
}
const csv = (value: unknown) => {
  const cell = String(value ?? "");
  return '"' + (/^[\s]*[=+\-@]/.test(cell) ? "'" : "") + cell.replaceAll('"','""') + '"';
};

export async function staffRoute(request: NextRequest, path: string[], user: Viewer) {
  const [area, resource, item, action] = path;
  const method = request.method;
  requireAccess(user, area === "admin" ? "admin" : "officer");
  if (path.length > 4) throw missing();
  const data = () => request.json() as Promise<unknown>;
  const db = database();
  if (area === "officer") {
    if (method === "GET" && resource === "overview" && !item)
      return response(await operations(request.nextUrl.searchParams.get("q") ?? ""));
    if (method === "POST" && item && resource === "sessions" && action === "correct") {
      const payload = z.object({ reason }).parse(await data());
      return response(await release(user,uuid.parse(item),uuid.parse(request.headers.get("idempotency-key")),payload.reason));
    }
    if (method === "POST" && item && resource === "spaces" && action === "verify")
      return response(await verify(user,uuid.parse(item),await data()));
    if (method === "PATCH" && item && resource === "reports" && !action)
      return response(await resolveReport(user,uuid.parse(item),await data()));
    throw missing();
  }
  if (action) throw missing();
  if (method === "GET" && resource === "inventory" && !item)
    return response({
      zones: await db`select z.*,count(s.id)::int as inventory from app.zones z
        left join app.spaces s on s.zone_id=z.id and s.published and s.state<>'retired'
        group by z.id order by z.code limit 500`,
      spaces: await db`select *,x::float8,y::float8 from app.spaces order by code limit 5000`,
      access: await db`select * from app.access_rules order by zone_id,role,kind`,
      grants: await db`select g.zone_id,g.user_id,p.name,g.kind,g.expires_at from app.access_grants g
        join app.profiles p on p.id=g.user_id order by g.zone_id,p.name,g.kind`,
    });
  if (method === "GET" && resource === "accounts" && !item) {
    const query = (request.nextUrl.searchParams.get("q") ?? "").toLowerCase().trim().slice(0,100);
    return response(await db`select * from app.profiles where position(${query} in lower(name))>0
      order by verified,created_at desc limit 150`);
  }
  if (method === "GET" && resource === "notices" && !item)
    return response({ notices: await db`select id,title,body,audience::text[] as audience,state,expires_at
      from app.announcements order by created_at desc limit 100`,
      rules: await db`select * from app.parking_rules order by updated_at desc limit 100` });
  if (method === "GET" && resource === "audit" && !item) return response(await db`
    select a.*,p.name as actor_name,z.code as zone_code from app.activity a
    left join app.profiles p on p.id=a.actor left join app.zones z on z.id=a.zone_id
    order by a.at desc,a.id desc limit 100`);
  if (method === "GET" && resource === "analytics" && !item) return response(await analytics());
  if (method === "GET" && resource === "analytics" && item === "csv") {
    const rows = await analytics();
    const columns = ["code","name","category","inventory","occupied","sessions_30d","average_minutes_30d"];
    const body = [columns.join(","),...rows.map((row) => columns.map((key) => csv(row[key])).join(","))].join("\r\n");
    return new NextResponse(body,{ headers: { "Content-Type":"text/csv; charset=utf-8",
      "Content-Disposition":'attachment; filename="parking-summary.csv"',"Cache-Control":"private, no-store" } });
  }
  if (method === "PATCH" && resource === "accounts" && item) return response(await userSave(user,uuid.parse(item),await data()));
  if (method === "POST" && !item && (resource === "access" || resource === "grants"))
    return response(await accessSave(user,await data(),resource === "grants"));
  if ((method === "POST" && !item) || (method === "PATCH" && item)) {
    const id = item ? uuid.parse(item) : undefined;
    if (resource === "zones") return response(await zoneSave(user,await data(),id));
    if (resource === "spaces") return response(await spaceSave(user,await data(),id));
    if (resource === "notices") return response(await noticeSave(user,await data(),id));
    if (resource === "rules") return response(await ruleSave(user,await data(),id));
  }
  throw missing();
}
```

### `src/components/staff.tsx`

<!-- file: src/components/staff.tsx -->

```tsx
"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { api, campusTime, mutation } from "@/lib/api";
import { categories, kinds, roles, states, type Report, type Role, type Session, type Space, type Zone } from "@/lib/contracts";

type OfficerSpace = { id: string; code: string; state: string; occupied: boolean; zone_open: boolean };
type OfficerData = { sessions: Session[]; reports: Report[]; spaces: OfficerSpace[] };
type Account = { id: string; name: string; registration: string; role: Role; verified: boolean; suspended: boolean; max_sessions: number };
type Inventory = {
  zones: Zone[]; spaces: Space[]; access: { zone_id: string; role: string; kind: string }[];
  grants: { zone_id: string; user_id: string; name: string; kind: string; expires_at: string }[];
};
type Notices = {
  notices: { id: string; title: string; body: string; audience: Role[]; state: string; expires_at: string | null }[];
  rules: { id: string; title: string; body: string; active: boolean }[];
};
type Audit = {
  id: string; action: string; actor_name: string | null; reason: string | null; at: string;
  actor: string; target: string; zone_code: string | null; details: Record<string, string | number | boolean>;
};
type Metric = { code: string; name: string; occupied: number; inventory: number; sessions_30d: number; average_minutes_30d: number };
type Save = (path: string, value: unknown, method?: string, key?: string) => Promise<void>;
const formData = (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault();
  return new FormData(event.currentTarget);
};
const value = (data: FormData, key: string) => String(data.get(key) ?? "");
const checked = (data: FormData, key: string) => data.has(key);
const date = (input: string) => {
  const text = input.trim();
  if (!text) return null;
  const result = new Date(text);
  if (!/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(text) || !Number.isFinite(+result)) {
    throw new Error("Enter a date and time with Z or an offset such as +05:30.");
  }
  return result.toISOString();
};

export function Staff({ admin, online, liveAt, onChanged }: {
  admin: boolean; online: boolean; liveAt?: string; onChanged: () => void;
}) {
  const [tab, setTab] = useState("Officer desk");
  const [query, setQuery] = useState("");
  const [accountQuery, setAccountQuery] = useState("");
  const [officer, setOfficer] = useState<OfficerData>();
  const [inventory, setInventory] = useState<Inventory>();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [notices, setNotices] = useState<Notices>();
  const [audit, setAudit] = useState<Audit[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [zoneId, setZoneId] = useState("");
  const [spaceId, setSpaceId] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const requests = useRef(new Map<string,string>());
  const writing = useRef(false);
  const reading = useRef<AbortController | null>(null);
  const changed = useRef(onChanged);
  changed.current = onChanged;
  const officerUpdatedAt = tab === "Officer desk" ? liveAt : undefined;

  const load = useCallback(async () => {
    reading.current?.abort();
    if (!navigator.onLine) return;
    const controller = new AbortController();
    reading.current = controller;
    const { signal } = controller;
    const get = async <T,>(path: string) => {
      const data = await api<T>(path,{ signal });
      signal.throwIfAborted();
      return data;
    };
    try {
      const q = (term: string) => "?q=" + encodeURIComponent(term);
      switch (tab) {
        case "Officer desk": setOfficer(await get<OfficerData>("officer/overview" + q(query))); break;
        case "Inventory": setInventory(await get<Inventory>("admin/inventory")); break;
        case "Accounts": setAccounts(await get<Account[]>("admin/accounts" + q(accountQuery))); break;
        case "Announcements": setNotices(await get<Notices>("admin/notices")); break;
        case "Audit and analytics": {
          const [log, rows] = await Promise.all([get<Audit[]>("admin/audit"),get<Metric[]>("admin/analytics")]);
          signal.throwIfAborted();
          setAudit(log); setMetrics(rows); break;
        }
      }
    } catch (error) {
      if (!signal.aborted) setMessage(error instanceof Error ? error.message : "Operations could not be loaded.");
    }
  }, [tab,query,accountQuery]);

  const latestLoad = useRef(load);
  useEffect(() => { latestLoad.current = load; }, [load]);
  useEffect(() => {
    const timeout = online ? setTimeout(() => void load(), 180) : undefined;
    return () => { reading.current?.abort(); clearTimeout(timeout); };
  }, [load, officerUpdatedAt, online]);

  const save: Save = async (path, payload, method = "POST", key) => {
    if (writing.current) throw new Error("Wait for the current update to finish.");
    if (!navigator.onLine) throw new Error("Reconnect before saving this change.");
    writing.current = true;
    setBusy(true); setMessage("");
    try {
      await api(path,mutation(payload,method,key));
      setMessage("Saved.");
      await latestLoad.current();
      changed.current();
    } finally { writing.current = false; setBusy(false); }
  };
  const submit = (task: () => Promise<void>) =>
    void Promise.resolve().then(task).catch((error: unknown) => {
      if (error instanceof Error) setMessage(error.message);
    });
  const disable = !online || busy;
  const zone = inventory?.zones.find((row) => row.id === zoneId);
  const space = inventory?.spaces.find((row) => row.id === spaceId && row.zone_id === zoneId);

  return <section className="stack">
    <nav className="actions" aria-label="Operations sections">
      {(admin ? ["Officer desk","Inventory","Accounts","Announcements","Audit and analytics"] : ["Officer desk"])
        .map((page) => <button key={page} aria-pressed={tab === page} onClick={() => { setTab(page); setMessage(""); }}>{page}</button>)}
      <button disabled={!online || busy} onClick={() => void load()}>Refresh</button>
    </nav>
    {message && <p className="card" role="status">{message}</p>}

    {tab === "Officer desk" && <>
      <label className="card">Search by zone or space code<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Z01-001" /></label>
      <div className="panel-grid">
        <div className="card"><h2>Active and stale sessions</h2>
          {officer?.sessions.length === 0 && <p>No active sessions found.</p>}
          {officer?.sessions.map((row) => <details key={row.id} className="record">
            <summary>{row.code} · {row.user_name}{row.stale ? " · Needs review" : ""}</summary>
            <p>{row.plate ?? row.kind} · {campusTime(row.started_at)}</p>
            {row.verified_at && <p>Verified {campusTime(row.verified_at)}</p>}
            <form onSubmit={(event) => {
              const why = value(formData(event),"reason");
              const action = row.id + ":" + why;
              const key = requests.current.get(action) ?? crypto.randomUUID();
              requests.current.set(action,key);
              submit(async () => {
                await save("officer/sessions/" + row.id + "/correct",{ reason:why },"POST",key);
                requests.current.delete(action);
              });
            }}><Reason /><button disabled={disable}>End incorrect session</button></form>
          </details>)}</div>
        <div className="card"><h2>Incident reports</h2>{officer?.reports.length === 0 && <p>No matching reports.</p>}
          {officer?.reports.map((row) => <details key={row.id} className="record">
            <summary>{row.space ?? row.zone} · {row.kind.replace("_"," ")} · {row.status}</summary>
            <p>{row.description}</p>
            {row.status === "resolved" ? <p>{row.resolution}</p> :
              <form onSubmit={(event) => {
                const resolution = value(formData(event),"reason");
                submit(() => save("officer/reports/" + row.id,{resolution},"PATCH"));
              }}><Reason /><button disabled={disable}>Resolve report</button></form>}
          </details>)}</div>
        <div className="card"><h2>Verify a space</h2>{officer?.spaces.length === 0 && <p>No matching spaces.</p>}
          {officer?.spaces.map((row) => <details key={row.id} className="record">
            <summary>{row.code} · {row.occupied && "Reported occupied · "}
              {row.zone_open ? row.state.replace("_"," ") : "Zone closed"}</summary>
            <form onSubmit={(event) => {
              const data = formData(event);
              submit(() => save("officer/spaces/" + row.id + "/verify",Object.fromEntries(data)));
            }}><label>Action<select name="state"><option value="unchanged">Record verification</option>
              <option disabled={row.state === "closed"} value="blocked">Block space</option>
              <option disabled={row.state === "closed"} value="under_review">Mark under review</option>
              <option disabled={row.state === "closed"} value="open">Clear block</option>
            </select></label><Reason /><button disabled={disable}>Record check</button></form>
          </details>)}</div>
      </div>
    </>}

    {tab === "Inventory" && inventory && <>
      <div className="card">
        <label>Parking zone<select value={zoneId} onChange={(event) => { setZoneId(event.target.value); setSpaceId(""); }}>
          <option value="">Create new zone</option>
          {inventory.zones.map((row) => <option key={row.id} value={row.id}>{row.code} · {row.name}</option>)}
        </select></label>
      </div>
      <div className="panel-grid">
        <div className="card"><h2>{zone ? "Edit zone" : "New zone"}</h2>
          <ZoneForm key={zone ? zone.id + ":" + zone.version : "new"} row={zone} disabled={disable} save={save} submit={submit} />
        </div>
        {zone && <div className="card stack"><h2>Spaces</h2>
          <p>{zone.inventory} published spaces</p>
          <label>Parking space<select value={spaceId} onChange={(event) => setSpaceId(event.target.value)}><option value="">Create space</option>
            {inventory.spaces.filter((row) => row.zone_id === zone.id).map((row) =>
              <option value={row.id} key={row.id}>{row.code} · {row.state}</option>)}</select></label>
          <SpaceForm key={space ? space.id + ":" + space.version : zone.id} zone={zone} row={space} disabled={disable} save={save} submit={submit} />
        </div>}
        {zone && <div className="card stack"><h2>Eligibility</h2>
          <p>{inventory.access.filter((row) => row.zone_id === zone.id).map((row) => row.role + " / " + row.kind).join(" · ") || "No role rules."}</p>
          <form onSubmit={(event) => {
            const data = formData(event);
            submit(() => save("admin/access",{ zoneId:zone.id, role:value(data,"role"),kind:value(data,"kind"),
              allowed:value(data,"direction")==="allow",reason:value(data,"reason") }));
          }}><RoleField /><KindField /><AccessField /><Reason /><button disabled={disable}>Apply role rule</button></form>
          <details><summary>Account-specific exception</summary>
            {(inventory.grants ?? []).filter((row) => row.zone_id === zone.id).map((row) =>
              <p className="record" key={row.user_id + ":" + row.kind}>
                {row.name} · {row.kind} · {+new Date(row.expires_at) <= Date.now() ? "Expired" : "Expires"} {campusTime(row.expires_at)}
              </p>)}
            <form onSubmit={(event) => {
              const data = formData(event);
              submit(() => save("admin/grants",{ zoneId:zone.id,userId:value(data,"user"),kind:value(data,"kind"),
                allowed:value(data,"direction")==="allow",expiresAt:date(value(data,"expiry"))??undefined,reason:value(data,"reason") }));
            }}><label>Account ID<input name="user" required placeholder="Copy the ID from Accounts" /></label><KindField />
              <label>Expiry with timezone<input name="expiry" placeholder="2027-01-31T18:00:00+05:30" /></label>
              <AccessField /><Reason /><button disabled={disable}>Apply account exception</button></form>
          </details>
        </div>}
      </div>
    </>}

    {tab === "Accounts" && <div className="card">
      <h2>Accounts</h2><label>Search name<input value={accountQuery} onChange={(event) => setAccountQuery(event.target.value)} /></label>
      {accounts.map((row) => <details className="record" key={row.id + row.role + row.verified + row.suspended + row.max_sessions}>
        <summary>{row.name} · {row.role} · {row.suspended ? "Suspended" : row.verified ? "Verified" : "Pending"}</summary>
        <p className="small">Account ID {row.id} · {row.registration} registration</p>
        <form onSubmit={(event) => {
          const data = formData(event);
          submit(() => save("admin/accounts/" + row.id,{ role:value(data,"role"),verified:checked(data,"verified"),suspended:checked(data,"suspended"),
            max_sessions:Number(value(data,"max")),reason:value(data,"reason") },"PATCH"));
        }}><RoleField initial={row.role} /><label>Maximum concurrent sessions<input name="max" type="number" min="1" max="10" defaultValue={row.max_sessions} required /></label>
          <Check name="verified" label="Verified affiliation" initial={row.verified} /><Check name="suspended" label="Suspended" initial={row.suspended} />
          <Reason /><button disabled={disable}>Save account</button></form>
      </details>)}
    </div>}

    {tab === "Announcements" && notices && <div className="panel-grid">
      <div className="card"><h2>Announcements</h2>
        <NoticeForm disabled={disable} save={save} submit={submit} />
        {notices.notices.map((row) => <details key={row.id + row.state} className="record"><summary>{row.title} · {row.state}</summary>
          <NoticeForm row={row} disabled={disable} save={save} submit={submit} /></details>)}
      </div>
      <div className="card"><h2>Parking rules</h2>
        <RuleForm disabled={disable} save={save} submit={submit} />
        {notices.rules.map((row) => <details key={row.id} className="record"><summary>{row.title}</summary>
          <RuleForm row={row} disabled={disable} save={save} submit={submit} /></details>)}
      </div>
    </div>}

    {tab === "Audit and analytics" && <div className="panel-grid">
      <div className="card"><h2>Parking activity</h2><p>Counts reflect manually reported sessions.</p>
        <p><a href="/api/v1/admin/analytics/csv" download>Download zone summary CSV</a></p>
        {metrics.map((row) => <article key={row.code} className="record"><h3>{row.code} · {row.name}</h3>
          <p>{row.occupied} occupied / {row.inventory} spaces · {row.sessions_30d} sessions in 30 days</p>
          <p>Average completed session in period: {row.average_minutes_30d} min</p></article>)}</div>
      <div className="card"><h2>Audit history</h2>
        {audit.map((row) => <article key={row.id} className="record"><strong>{row.action} · {row.actor_name ?? "Account " + row.actor}</strong>
          {row.zone_code && <p>{row.zone_code}{typeof row.details.state === "string" && " · " + row.details.state.replace("_"," ")}</p>}
          <p>{row.reason}</p><time dateTime={row.at}>{campusTime(row.at)}</time>
          <details><summary>Change details</summary>
            <p className="small">Target {row.target}</p>
            {Object.entries(row.details).filter(([, entry]) => entry !== "").map(([key, entry]) =>
              <p key={key}>{key.replaceAll("_"," ")} · {typeof entry === "boolean" ? entry ? "Yes" : "No" : entry}</p>)}
          </details>
        </article>)}</div>
    </div>}
  </section>;
}

const Reason = () => <label>Reason<textarea name="reason" required minLength={3} maxLength={500} /></label>;
const Check = ({ name,label,initial }: { name:string; label:string; initial:boolean }) =>
  <label className="check"><input type="checkbox" name={name} defaultChecked={initial} />{label}</label>;
const RoleField = ({ initial = "visitor" }: { initial?: Role }) =>
  <label>Role<select name="role" defaultValue={initial}>{roles.map((role) => <option key={role}>{role}</option>)}</select></label>;
const KindField = () => <label>Vehicle type<select name="kind">{kinds.map((kind) => <option key={kind}>{kind}</option>)}</select></label>;
const AccessField = () => <label>Action<select name="direction"><option value="allow">Allow</option><option value="remove">Remove allowance</option></select></label>;
type Editor = { disabled: boolean; save: Save; submit: (task: () => Promise<void>) => void };

function ZoneForm({ row,disabled,save,submit }: Editor & { row?: Zone }) {
  return <form onSubmit={(event) => {
    const data = formData(event);
    submit(() => save("admin/zones" + (row ? "/" + row.id : ""), {
      code:value(data,"code"),name:value(data,"name"),category:value(data,"category"),geometry:JSON.parse(value(data,"geometry")),
      proposed_capacity:Number(value(data,"capacity")),instructions:value(data,"instructions"),open:checked(data,"open"),
      published:checked(data,"published"),verified:checked(data,"verified"),version:row?.version ?? 0,reason:value(data,"reason"),
    },row ? "PATCH" : "POST"));
  }}>
    <label>Zone code<input name="code" defaultValue={row?.code} placeholder="Z28" required readOnly={!!row} /></label>
    <label>Name<input name="name" defaultValue={row?.name} required maxLength={100} /></label>
    <label>Display category<select name="category" defaultValue={row?.category}>{categories.map((kind) => <option key={kind}>{kind}</option>)}</select></label>
    <label>Proposed capacity<input name="capacity" type="number" min="0" max="500" defaultValue={row?.proposed_capacity ?? 0} required /></label>
    <label>Local map geometry<textarea name="geometry" defaultValue={JSON.stringify(row?.geometry ?? { type:"box",x:500,y:500,w:30,h:15,r:0 },null,2)} required /></label>
    <label>Parking instructions<textarea name="instructions" defaultValue={row?.instructions} maxLength={1000} /></label>
    <Check name="open" label="Open for parking" initial={row?.open ?? false} />
    <Check name="published" label="Published to the map" initial={row?.published ?? false} />
    <Check name="verified" label="Field verified" initial={row?.verified ?? false} />
    <Reason /><button disabled={disabled}>Save zone</button>
  </form>;
}

function SpaceForm({ zone,row,disabled,save,submit }: Editor & { zone:Zone; row?:Space }) {
  return <form onSubmit={(event) => {
    const data = formData(event);
    submit(() => save("admin/spaces" + (row ? "/" + row.id : ""), {
      zone_id:zone.id,code:value(data,"code"),x:Number(value(data,"x")),y:Number(value(data,"y")),state:value(data,"state"),
      published:checked(data,"published"),verified:checked(data,"verified"),version:row?.version ?? 0,reason:value(data,"reason"),
    },row ? "PATCH" : "POST"));
  }}>
    <label>Space code<input name="code" defaultValue={row?.code} placeholder={zone.code + "-001"} required readOnly={!!row} /></label>
    <label>Local X<input name="x" type="number" step="any" defaultValue={row?.x} required /></label>
    <label>Local Y<input name="y" type="number" step="any" defaultValue={row?.y} required /></label>
    <label>State<select name="state" defaultValue={row?.state ?? "closed"}>{states.map((state) => <option key={state}>{state}</option>)}</select></label>
    <Check name="published" label="Published to the map" initial={row?.published ?? false} />
    <Check name="verified" label="Field verified" initial={row?.verified ?? false} />
    <Reason /><button disabled={disabled}>Save space</button>
  </form>;
}

function NoticeForm({ row,disabled,save,submit }: Editor & { row?:Notices["notices"][number] }) {
  return <form onSubmit={(event) => {
    const data = formData(event);
    submit(() => save("admin/notices" + (row ? "/" + row.id : ""), {
      title:value(data,"title"),body:value(data,"body"),audience:data.getAll("audience"),state:value(data,"state"),
      expiresAt:date(value(data,"expiry")),reason:value(data,"reason"),
    },row ? "PATCH" : "POST"));
  }}>
    <label>Title<input name="title" defaultValue={row?.title} required maxLength={120} /></label>
    <label>Message<textarea name="body" defaultValue={row?.body} required maxLength={2000} /></label>
    <label>Audience (empty selection means all)<select name="audience" multiple defaultValue={row?.audience ?? []}>
      {roles.map((role) => <option key={role}>{role}</option>)}</select></label>
    <label>Status<select name="state" defaultValue={row?.state ?? "draft"}>{["draft","published","archived"].map((state) => <option key={state}>{state}</option>)}</select></label>
    <label>Expiry with timezone<input name="expiry" defaultValue={row?.expires_at ?? ""} placeholder="Optional ISO date and time" /></label>
    <Reason /><button disabled={disabled}>Save announcement</button>
  </form>;
}

function RuleForm({ row,disabled,save,submit }: Editor & { row?:Notices["rules"][number] }) {
  return <form onSubmit={(event) => {
    const data = formData(event);
    submit(() => save("admin/rules" + (row ? "/" + row.id : ""), {
      title:value(data,"title"),body:value(data,"body"),active:checked(data,"active"),reason:value(data,"reason"),
    },row ? "PATCH" : "POST"));
  }}>
    <label>Title<input name="title" defaultValue={row?.title} required maxLength={120} /></label>
    <label>Rule<textarea name="body" defaultValue={row?.body} required maxLength={2000} /></label>
    <Check name="active" label="Published" initial={row?.active ?? false} />
    <Reason /><button disabled={disabled}>Save rule</button>
  </form>;
}
```
