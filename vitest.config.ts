import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { testDatabaseUrl } from "./tests/db-url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    // Integration files share one database.
    fileParallelism: false,
    env: { DATABASE_URL: testDatabaseUrl(), NEXT_PUBLIC_LINK_HOST: "monitr.link" },
  },
});
