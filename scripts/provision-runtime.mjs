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
