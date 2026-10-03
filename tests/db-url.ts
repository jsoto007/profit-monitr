import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Tests write to a database, so the target is derived — never taken as-is —
 * from the local .env: same server, database "<name>_test". TEST_DATABASE_URL
 * overrides it (CI). Anything that does not resolve to a local server is refused.
 */
export function testDatabaseUrl(): string {
  let url: URL;
  if (process.env.TEST_DATABASE_URL) {
    url = new URL(process.env.TEST_DATABASE_URL);
  } else {
    let base = "postgresql://localhost:5432/profit_monitr";
    try {
      const m = /^DATABASE_URL="?([^"\n]+)"?/m.exec(readFileSync(join(process.cwd(), ".env"), "utf8"));
      if (m) base = m[1];
    } catch {
      /* no .env — use the default */
    }
    url = new URL(base);
    url.pathname = url.pathname.replace(/(_test)?$/, "_test");
  }
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) && !process.env.CI) {
    throw new Error(`Refusing to run tests against a non-local database host (${url.hostname}).`);
  }
  return url.toString();
}
