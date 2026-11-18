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
