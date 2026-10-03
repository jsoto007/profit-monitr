import { NextResponse } from "next/server";
import { clientKey, handler, HttpError, readJson, str } from "@/lib/api";
import { createSession, hasAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { blocked, forgive, rateLimit, spend } from "@/lib/rate-limit";

/** One message for every failure, so the form cannot be used to probe for accounts. */
const BAD_LOGIN = "We couldn’t find that email and password.";
const MAX_FAILURES = 20;

export const POST = handler(async (req: Request) => {
  rateLimit(`login:${clientKey(req)}`, 12, 60_000);
  const b = await readJson<{ email?: string; password?: string }>(req);
  const email = str(b.email, 200).toLowerCase();
  const password = typeof b.password === "string" ? b.password.slice(0, 200) : "";
  if (!email || !password) throw new HttpError(401, BAD_LOGIN);
  // Wrong passwords are also counted per address, so guesses cannot be spread across many
  // callers. Only failures count, and a successful log-in clears them.
  const failures = `login-failed:${email}`;
  if (blocked(failures, MAX_FAILURES)) throw new HttpError(429, "Too many attempts. Please wait a few minutes and try again.");
  const user = await db.user.findUnique({ where: { email }, include: { venue: true } });
  const usable = !!user?.venue && hasAccess(user.venue.subscriptionStatus);
  // Always run the hash so response time does not reveal whether the email exists.
  const ok = await verifyPassword(password, user?.passwordHash ?? "scrypt$00$00");
  if (!user || !usable || !ok) {
    spend(failures, 15 * 60_000);
    throw new HttpError(401, BAD_LOGIN);
  }
  forgive(failures);
  await createSession(user.id);
  return NextResponse.json({ ok: true });
});
