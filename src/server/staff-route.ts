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
