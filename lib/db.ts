import { env } from "cloudflare:workers";
import { schemaStatements } from "../db/schema";

let initialized = false;

export async function database() {
  const db = (env as unknown as { DB: D1Database }).DB;
  if (!initialized) {
    await db.batch(schemaStatements.map((sql) => db.prepare(sql)));
    initialized = true;
  }
  return db;
}

export type UserRecord = { id: string; name: string; email: string; created_at: string };
