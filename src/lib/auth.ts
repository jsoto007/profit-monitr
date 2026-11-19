import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "./db";
import { randomToken, sha256 } from "./password";

export const SESSION_COOKIE = "pm_session";
const SESSION_DAYS = 30;

/**
 * Subscription states that may use the app. Today every venue is "pilot" (free,
 * nothing charged) or "demo" (the shared public login). The others are here for
 * real billing: "past_due" keeps access while the card is retried; anything
 * else — pending, canceled, unpaid, incomplete — is locked out.
 */
const ACCESS = new Set(["active", "trialing", "past_due", "pilot", "demo"]);
export const hasAccess = (status: string) => ACCESS.has(status);

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof loadUserByToken>>>;

async function loadUserByToken(token: string) {
  const session = await db.authSession.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: { include: { venue: true } } },
  });
  if (!session || session.expiresAt < new Date() || !session.user.venue) return null;
  if (!hasAccess(session.user.venue.subscriptionStatus)) return null;
  return session.user as typeof session.user & { venue: NonNullable<typeof session.user.venue> };
}

/** The signed-in user (with venue) for the current request, or null. Memoised per request. */
export const getCurrentUser = cache(async () => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return loadUserByToken(token);
});

export class AuthError extends Error {
  status = 401;
  constructor() {
    super("Not signed in");
  }
}

/** For route handlers: 401 when signed out. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new AuthError();
  return user;
}

/**
 * For pages under /app: redirect to login when signed out. Layouts and pages
 * render in parallel, so every page checks for itself instead of trusting a
 * layout's redirect to have fired first.
 */
export async function requirePageUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Creates a session row (hashed token) and sets the cookie on the outgoing response. */
export async function createSession(userId: string, days = SESSION_DAYS) {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + days * 86400 * 1000);
  await db.authSession.create({ data: { tokenHash: sha256(token), userId, expiresAt } });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await db.authSession.deleteMany({ where: { tokenHash: sha256(token) } });
  store.delete(SESSION_COOKIE);
}
