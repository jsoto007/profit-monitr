import { HttpError } from "./api";

/**
 * Fixed-window limits and small counters held in process memory. Good enough
 * for one Render instance; move to Postgres or Redis before scaling out.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

function hit(key: string, windowMs: number, now: number): number {
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 5000) for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
    return 1;
  }
  return ++b.count;
}

export function rateLimit(key: string, max: number, windowMs: number, now = Date.now()): void {
  if (hit(key, windowMs, now) > max) throw new HttpError(429, "Too many attempts. Please wait a minute and try again.");
}

/**
 * A limit that is spent only by the outcome it guards (failed log-ins,
 * completed bookings): `blocked` reads it, `spend` counts one, `forgive` clears it.
 */
export function blocked(key: string, max: number, now = Date.now()): boolean {
  const b = buckets.get(key);
  return !!b && b.resetAt > now && b.count >= max;
}
export function spend(key: string, windowMs: number, now = Date.now()): void {
  hit(key, windowMs, now);
}
export function forgive(key: string): void {
  buckets.delete(key);
}

/** True the first time a key is seen in a window — for de-duplicating clicks. */
export function firstInWindow(key: string, windowMs: number, now = Date.now()): boolean {
  return hit(key, windowMs, now) === 1;
}

/** Open-connection counter (live streams). `acquire` returns false when the cap is reached. */
const open = new Map<string, number>();
export function acquire(key: string, max: number): boolean {
  const n = open.get(key) ?? 0;
  if (n >= max) return false;
  open.set(key, n + 1);
  return true;
}
export function release(key: string): void {
  const n = (open.get(key) ?? 1) - 1;
  if (n <= 0) open.delete(key);
  else open.set(key, n);
}

export function resetRateLimits() {
  buckets.clear();
  open.clear();
}
