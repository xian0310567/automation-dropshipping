import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { getServerEnv } from "@/server/env";
import * as schema from "./schema";

export function createDb(connectionString = getRequiredDatabaseUrl()) {
  return drizzle(neon(connectionString), { schema });
}

function getRequiredDatabaseUrl(): string {
  const env = getServerEnv();

  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for database access");
  }

  return env.DATABASE_URL;
}

export type DbClient = ReturnType<typeof createDb>;
