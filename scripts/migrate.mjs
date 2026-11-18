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
