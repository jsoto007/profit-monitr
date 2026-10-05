import { defineConfig, devices } from "@playwright/test";
import { testDatabaseUrl } from "./tests/db-url";

const PORT = 3211;

/**
 * End-to-end smoke tests against a production build, using the local test
 * database (never the dev or a remote one). Uses the installed Chrome, so no
 * browser download is needed.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [{ name: "chrome", use: { ...devices["Desktop Chrome"], channel: "chrome", viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: `npx prisma migrate deploy && npm run db:seed && npx next build && npx next start --port ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
    // ALLOW_SIGNUPS: a production build keeps sign-up closed unless free pilot accounts are explicitly accepted.
    env: { DATABASE_URL: testDatabaseUrl(), APP_URL: `http://localhost:${PORT}`, NEXT_PUBLIC_LINK_HOST: "monitr.link", ALLOW_SIGNUPS: "1" },
  },
});
