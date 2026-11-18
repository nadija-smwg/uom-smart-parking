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
