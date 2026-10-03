import "dotenv/config";
import { ensureDemoAccount } from "../src/lib/accounts";
import { db } from "../src/lib/db";

/**
 * Creates (or keeps) the shared demo login shown on the log-in page:
 * demo@copperroom.com — The Copper Room. Idempotent; runs on every deploy.
 */
async function main() {
  const user = await ensureDemoAccount();
  await db.authSession.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  console.log(`Demo account ready: ${user.email} (venue: ${user.venue?.name})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
