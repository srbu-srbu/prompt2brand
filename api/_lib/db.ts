import { neon } from "@neondatabase/serverless";

export function getDatabaseUrl(): string {
  const url =
    process.env.POSTGRES_URL ??
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL_NON_POOLING;

  if (!url) {
    throw new Error("POSTGRES_URL is not configured");
  }
  return url;
}

export function getSql() {
  return neon(getDatabaseUrl());
}

export type SqlClient = ReturnType<typeof neon>;
