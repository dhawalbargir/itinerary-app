import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

let _db: NeonHttpDatabase<typeof schema> | null = null;

/** Lazily create the client so builds succeed without DATABASE_URL. */
export function db() {
  if (!_db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set. Connect a Neon database in Vercel → Storage.");
    _db = drizzle(neon(url), { schema });
  }
  return _db;
}

export * from "./schema";
