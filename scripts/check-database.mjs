import assert from "node:assert/strict";
import { randomUUID, randomInt } from "node:crypto";
import postgres from "postgres";

const { APP_ENV, MIGRATION_DATABASE_URL: url, CONFIRM_DATABASE_TEST } = process.env;
if (APP_ENV !== "demo" || CONFIRM_DATABASE_TEST !== "yes" || !url)
  throw new Error("Use an isolated TEST project with APP_ENV=demo and CONFIRM_DATABASE_TEST=yes.");
const db=postgres(url,{max:5,prepare:false});
const [first,second,zone,vehicleA,vehicleB,spaceA,spaceB,keyA,keyB] = Array.from({length:9},randomUUID);
const code="Z"+randomInt(10000,99999);
const timeout = () => ({ x:40, y:40, w:20, h:20, r:0, type:"box" });
const claim=(person,vehicle,space,key)=>db`select app.claim(${person},${vehicle},${space},${key},false) as id`;
try {
  await db.begin(async (tx)=>{
    await tx`insert into auth.users(id,email) values (${first},${first+"@example.test"}),(${second},${second+"@example.test"})`;
    await tx`insert into app.profiles(id,name,registration,role,verified)
      values (${first},'Test driver A','campus','student',true),(${second},'Test driver B','visitor','visitor',true)`;
    await tx`insert into app.vehicles(id,user_id,kind) values (${vehicleA},${first},'bicycle'),(${vehicleB},${second},'bicycle')`;
    await tx`insert into app.zones(id,code,name,category,proposed_capacity,geometry)
      values (${zone},${code},'Transaction test fixture','bicycles',2,${tx.json(timeout())})`;
    await tx`insert into app.spaces(id,zone_id,code,x,y) values
      (${spaceA},${zone},${code+"-001"},35,35),(${spaceB},${zone},${code+"-002"},45,45)`;
    await tx`insert into app.access_rules values(${zone},'student','bicycle')`;
  });
  await assert.rejects(claim(second,vehicleB,spaceA,keyB),/PARKING_FORBIDDEN/);
  await db`insert into app.access_rules values(${zone},'visitor','bicycle')`;
  const attempts=await Promise.allSettled([claim(first,vehicleA,spaceA,keyA),claim(second,vehicleB,spaceA,keyB)]);
  const a=attempts[0].status==="fulfilled";
  const success=a?attempts[0]:attempts[1];
  const loser=a?attempts[1]:attempts[0];
  assert.equal(success.status,"fulfilled");
  assert.equal(loser.status,"rejected");
  assert.match(String(loser.reason),/SPACE_UNAVAILABLE/);
  const actor=a?first:second, vehicle=a?vehicleA:vehicleB, key=a?keyA:keyB;
  const [{id}]=success.value;
  assert.equal((await claim(actor,vehicle,spaceA,key))[0].id,id);
  await assert.rejects(claim(actor,vehicle,spaceB,key),/REQUEST_REUSED/);
  await assert.rejects(claim(actor,vehicle,spaceB,randomUUID()),/ACTIVE_SESSION_LIMIT/);
  await db`update app.zones set open=false where id=${zone}`;
  const endKey=randomUUID();
  const [released]=await db`select app.release(${actor},${id},${endKey},null) as id`;
  assert.equal(released.id,id);
  const [{count}]=await db`select count(*)::int as count from app.activity where target=${id} and action='session.end'`;
  assert.equal(count,1);
  assert.equal((await db`select app.release(${actor},${id},${endKey},null) as id`)[0].id,id);
  await assert.rejects(claim(first,vehicleA,spaceA,randomUUID()),/SPACE_UNAVAILABLE/);
  console.log("PostgreSQL checks passed: eligibility, concurrent claim, request replay, limits, closure and release.");
} finally {
  try {
    await db.begin(async(tx)=>{
      await tx`delete from app.activity where actor in (${first},${second})`;
      await tx`delete from app.requests where actor in (${first},${second})`;
      await tx`delete from app.sessions where space_id in (${spaceA},${spaceB})`;
      await tx`delete from app.access_rules where zone_id=${zone}`;
      await tx`delete from app.spaces where id in (${spaceA},${spaceB})`;
      await tx`delete from app.zones where id=${zone}`;
      await tx`delete from app.vehicles where id in (${vehicleA},${vehicleB})`;
      await tx`delete from app.profiles where id in (${first},${second})`;
      await tx`delete from auth.users where id in (${first},${second})`;
    });
  } finally { await db.end(); }
}
