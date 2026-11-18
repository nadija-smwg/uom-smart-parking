import { readFile } from "node:fs/promises";
import postgres from "postgres";

const { APP_ENV, DATABASE_URL: url, CONFIRM_DEMO_SEED } = process.env;
if (APP_ENV !== "demo" || CONFIRM_DEMO_SEED !== "yes" || !url)
  throw new Error("Set APP_ENV=demo, CONFIRM_DEMO_SEED=yes, and a DEMO runtime DATABASE_URL.");
const campus = JSON.parse(await readFile("data/campus.json", "utf8"));
const ca = process.env.DATABASE_SSL_CA?.trim();
const ssl = ca ? { ca, rejectUnauthorized: true } : undefined;
const db = postgres(url, { max: 1, prepare: false, ssl });
const kinds = { cars: ["car", "van"], motorcycles: ["motorcycle"], bicycles: ["bicycle"], university: ["university"], other: ["other"] };
const baseRoles = ["student", "lecturer", "staff", "officer", "admin"];

function point(geometry, index, count) {
  if (geometry.type === "box") {
    const { x, y, w, h, r } = geometry;
    const cols = Math.min(count, Math.max(1, Math.ceil(Math.sqrt(count * w / h))));
    const rows = Math.ceil(count / cols);
    const dx = ((index % cols + .5) / cols - .5) * w;
    const dy = ((Math.floor(index / cols) + .5) / rows - .5) * h;
    const angle = r * Math.PI / 180;
    return [x + dx * Math.cos(angle) - dy * Math.sin(angle), y + dx * Math.sin(angle) + dy * Math.cos(angle)];
  }
  const parts = geometry.points.slice(1).map((b, i) => {
    const a = geometry.points[i];
    return { a, b, length: Math.hypot(b[0] - a[0], b[1] - a[1]) };
  });
  let offset = parts.reduce((sum, part) => sum + part.length, 0) * (index + .5) / count;
  for (const part of parts) {
    if (offset <= part.length && part.length > 0) {
      const t = offset / part.length;
      return [part.a[0] + (part.b[0] - part.a[0]) * t, part.a[1] + (part.b[1] - part.a[1]) * t];
    }
    offset -= part.length;
  }
  return geometry.points.at(-1);
}

try {
  await db.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(190086043)`;
    if ((await tx`select id from app.zones limit 1`).length) throw new Error("Demo seed requires empty zone inventory.");
    for (const zone of campus.zones) {
      const [{ id }] = await tx`insert into app.zones(code,name,category,proposed_capacity,geometry,instructions)
        values (${zone.code},${zone.name},${zone.category},${zone.capacity},${tx.json(zone.geometry)},
          'Planning reference. Follow posted signs and officer instructions.') returning id`;
      const spaces = Array.from({ length: zone.capacity }, (_, i) => {
        const [x, y] = point(zone.geometry, i, zone.capacity);
        return { zone_id: id, code: zone.code + "-" + String(i + 1).padStart(3, "0"), x, y };
      });
      await tx`insert into app.spaces ${tx(spaces)}`;
      const roles = zone.category === "university" ? ["staff", "admin"] :
        zone.category === "other" ? [] : ["Z01", "Z11"].includes(zone.code) ? [...baseRoles, "visitor"] : baseRoles;
      for (const role of roles) for (const kind of kinds[zone.category]) {
        await tx`insert into app.access_rules(zone_id,role,kind) values (${id},${role},${kind})`;
      }
    }
    await tx`insert into app.parking_rules(title,body)
      values ('Manual parking reports','Confirm only once you have parked. End your session when you leave. Follow campus signage and security instructions.')`;
  });
  console.log("Loaded 27 proposed zones and 440 demo spaces.");
} finally {
  await db.end();
}
