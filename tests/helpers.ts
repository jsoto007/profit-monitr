import { createAccount, type NewAccount } from "@/lib/accounts";
import type { CurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

/** Empties every table. Guarded: only ever runs against a database whose name ends in _test. */
export async function resetDb() {
  const [{ current_database: name }] = await db.$queryRaw<{ current_database: string }[]>`SELECT current_database()`;
  if (!name.endsWith("_test")) throw new Error(`resetDb refused: "${name}" is not a test database.`);
  await db.$executeRawUnsafe('TRUNCATE "User" CASCADE');
}

let n = 0;
export async function makeAccount(over: Partial<NewAccount> = {}): Promise<CurrentUser> {
  n++;
  const user = await createAccount({
    name: "Dana Test", email: `owner${n}-${Date.now()}@example.test`, password: "correct horse 9!",
    venue: `Test Venue ${n}`, vtype: "Restaurant", city: "Brooklyn, NY", website: "", timezone: "America/New_York",
    sellsReservations: true, sellsTickets: true, promos: ["Email"], cardLast4: "4242", subscriptionStatus: "demo",
    ...over,
  });
  return user as CurrentUser;
}
