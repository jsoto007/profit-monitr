import { execSync } from "node:child_process";
import { testDatabaseUrl } from "./db-url";

/** Brings the test database up to the current schema before any test runs. */
export default function setup() {
  const url = testDatabaseUrl();
  const u = new URL(url);
  console.log(`[tests] database: ${u.hostname}${u.pathname}`);
  execSync("npx prisma migrate deploy", { stdio: "pipe", env: { ...process.env, DATABASE_URL: url } });
}
