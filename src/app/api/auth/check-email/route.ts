import { NextResponse } from "next/server";
import { clientKey, handler, readJson, str } from "@/lib/api";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

/** Lets step 1 of sign-up flag an email that is already registered before moving on. */
export const POST = handler(async (req: Request) => {
  rateLimit(`check-email:${clientKey(req)}`, 20, 60_000);
  const b = await readJson<{ email?: string }>(req);
  const email = str(b.email, 200).toLowerCase();
  const exists = !!email && !!(await db.user.findUnique({ where: { email }, select: { id: true } }));
  return NextResponse.json({ exists });
});
