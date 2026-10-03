/**
 * Time-zone aware calendar maths without a date library. Everything is stored
 * in UTC; a venue's weeks, "today" and the Monday brief follow its IANA zone.
 */

export const DEFAULT_TZ = "America/New_York";

export type Parts = { y: number; m: number; d: number; h: number; min: number; s: number; dow: number };

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function partsFormat(tz: string): Intl.DateTimeFormat {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23", weekday: "short",
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
    fmtCache.set(tz, f);
  }
  return f;
}

const DOW: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || !tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Wall-clock parts of an instant in a zone. `dow` is Monday = 0 … Sunday = 6. */
export function zonedParts(date: Date, tz: string): Parts {
  const p: Record<string, string> = {};
  for (const x of partsFormat(tz).formatToParts(date)) p[x.type] = x.value;
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, min: +p.minute, s: +p.second, dow: DOW[p.weekday] };
}

/** The UTC instant at which a zone's wall clock reads the given local time. */
export function zonedTimeToUtc(y: number, m: number, d: number, h: number, min: number, tz: string): Date {
  const target = Date.UTC(y, m - 1, d, h, min);
  let guess = target;
  // Two passes settle the offset on either side of a DST change.
  for (let i = 0; i < 2; i++) {
    const p = zonedParts(new Date(guess), tz);
    guess += target - Date.UTC(p.y, p.m - 1, p.d, p.h, p.min);
  }
  return new Date(guess);
}

/** Local midnight `days` calendar days away from the local day containing `date`. */
export function startOfDay(date: Date, tz: string, days = 0): Date {
  const p = zonedParts(date, tz);
  const shifted = new Date(Date.UTC(p.y, p.m - 1, p.d + days));
  return zonedTimeToUtc(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate(), 0, 0, tz);
}

/** Monday 00:00 (local) of the week containing `date`, shifted by whole weeks. */
export function weekStart(date: Date, tz: string, weeks = 0): Date {
  return startOfDay(date, tz, -zonedParts(date, tz).dow + weeks * 7);
}

/** The calendar date of an instant in a zone, as a UTC-midnight Date (for DATE columns). */
export function calendarDate(date: Date, tz: string): Date {
  const p = zonedParts(date, tz);
  return new Date(Date.UTC(p.y, p.m - 1, p.d));
}

/** The Monday the next weekly brief lands — a week out when today is Monday. "Monday, Oct 5". */
export function nextBriefLabel(now: Date, tz: string): string {
  const next = weekStart(now, tz, 1);
  return next.toLocaleDateString("en-US", { timeZone: tz, weekday: "long", month: "short", day: "numeric" });
}

/** "Sep 21" */
export function shortDate(date: Date, tz: string): string {
  return date.toLocaleDateString("en-US", { timeZone: tz, month: "short", day: "numeric" });
}

/** "SEP 21–27" or "SEP 28–OCT 4" for the inclusive local days from..to(exclusive). */
export function rangeLabel(from: Date, toExclusive: Date, tz: string): string {
  const a = zonedParts(from, tz);
  const b = zonedParts(new Date(toExclusive.getTime() - 1), tz);
  const mo = (d: Date) => d.toLocaleDateString("en-US", { timeZone: tz, month: "short" }).toUpperCase();
  const last = new Date(toExclusive.getTime() - 1);
  return a.m === b.m ? `${mo(from)} ${a.d}–${b.d}` : `${mo(from)} ${a.d}–${mo(last)} ${b.d}`;
}

export type RangeKey = "week" | "last" | "month";
export const RANGE_KEYS: RangeKey[] = ["week", "last", "month"];
export const isRangeKey = (v: unknown): v is RangeKey => v === "week" || v === "last" || v === "month";

export type Window = { from: Date; to: Date; prevFrom: Date; prevTo: Date };

/**
 * week  → this Monday … next Monday (in progress)
 * last  → the Monday-to-Monday week before
 * month → the last four Monday weeks, including this one
 * `prev*` is the same-length window immediately before, for deltas.
 */
export function rangeWindow(key: RangeKey, now: Date, tz: string): Window {
  if (key === "week") return { from: weekStart(now, tz), to: weekStart(now, tz, 1), prevFrom: weekStart(now, tz, -1), prevTo: weekStart(now, tz) };
  if (key === "last") return { from: weekStart(now, tz, -1), to: weekStart(now, tz), prevFrom: weekStart(now, tz, -2), prevTo: weekStart(now, tz, -1) };
  return { from: weekStart(now, tz, -3), to: weekStart(now, tz, 1), prevFrom: weekStart(now, tz, -7), prevTo: weekStart(now, tz, -3) };
}

/**
 * A venue's "tonight" runs past midnight: the service day starts at 5 am local
 * and ends at 5 am the next morning, so a 12:10 am arrival belongs to the same
 * night as an 11:55 pm one.
 */
export const SERVICE_DAY_CUT_HOUR = 5;
export function serviceDay(now: Date, tz: string): { from: Date; to: Date } {
  const p = zonedParts(new Date(now.getTime() - SERVICE_DAY_CUT_HOUR * 3_600_000), tz);
  return { from: zonedTimeToUtc(p.y, p.m, p.d, SERVICE_DAY_CUT_HOUR, 0, tz), to: zonedTimeToUtc(p.y, p.m, p.d + 1, SERVICE_DAY_CUT_HOUR, 0, tz) };
}
