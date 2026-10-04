import { DEMO } from "@/data/sample";
import type { Venue } from "@/generated/prisma/client";
import type { CurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isProvider } from "@/lib/destinations";
import { calendarDate, nextBriefLabel, RANGE_KEYS, weekStart, type RangeKey } from "@/lib/time";
import { linkHost } from "@/lib/util";
import { realLive, realRange, realWebsite } from "./real";
import { sampleLive, sampleRange, sampleWebsite } from "./sample";
import type { ActionsData, DashboardPayload, LiveData, RangeData, WebsiteData } from "./types";

export * from "./types";

/** Range-dependent data: the sample venue or the venue's own measurements. */
export async function getRange(venue: Venue, key: RangeKey, now = new Date()): Promise<RangeData> {
  return venue.sampleData ? sampleRange(key) : realRange(venue, key, now);
}

const weekLabel = (d: Date) =>
  `WEEK OF ${d.toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" }).toUpperCase()}`;

/** The newest week's three moves plus the week before's results. */
export async function getActions(venue: Venue, now = new Date()): Promise<ActionsData> {
  const [rows, expert] = await Promise.all([
    db.action.findMany({ where: { venueId: venue.id, sample: venue.sampleData }, orderBy: [{ weekStart: "desc" }, { rank: "asc" }], take: 12 }),
    db.expertRequest.findFirst({ where: { venueId: venue.id, createdAt: { gte: new Date(now.getTime() - 14 * 86_400_000) } }, select: { id: true } }),
  ]);
  const weeks = [...new Set(rows.map((r) => r.weekStart.getTime()))];
  const current = rows.filter((r) => r.weekStart.getTime() === weeks[0]);
  const past = rows.filter((r) => r.weekStart.getTime() === weeks[1]);
  return {
    weekLabel: weekLabel(current[0]?.weekStart ?? calendarDate(weekStart(now, venue.timezone), venue.timezone)),
    current: current.map((a) => ({ id: a.id, title: a.title, description: a.description, estimate: a.estimate, tip: a.tip, approved: a.status !== "open" })),
    past: past.map((a) => ({ id: a.id, title: a.title, result: a.result || (a.status === "open" ? "Skipped" : ""), done: a.status === "done" || a.status === "approved" })),
    expertRequested: !!expert,
  };
}

export async function getWebsite(venue: Venue, isDemo: boolean): Promise<WebsiteData> {
  const rows = await db.recommendation.findMany({ where: { venueId: venue.id, sample: venue.sampleData }, orderBy: { rank: "asc" } });
  const recs = rows.map((r) => ({ id: r.id, title: r.title, description: r.description, approved: r.status !== "open" }));
  if (!venue.sampleData) return realWebsite(venue.website, recs);
  return sampleWebsite(isDemo ? DEMO.website : venue.website || DEMO.website, recs);
}

export async function getLive(venue: Venue, now = new Date()): Promise<LiveData> {
  const row = await db.agentNote.findFirst({ where: { venueId: venue.id, sample: venue.sampleData }, orderBy: { createdAt: "desc" } });
  const note = row ? { id: row.id, body: row.body, sent: row.status === "sent" } : null;
  return venue.sampleData ? sampleLive(now, note) : realLive(venue, now, note);
}

/** Everything the dashboard needs for first paint. `ranges` carries the requested ranges only. */
export async function getDashboard(user: CurrentUser, keys: RangeKey[] = RANGE_KEYS, now = new Date()): Promise<DashboardPayload> {
  const venue = user.venue;
  const [ranges, actions, website, live] = await Promise.all([
    Promise.all(keys.map(async (k) => [k, await getRange(venue, k, now)] as const)),
    getActions(venue, now),
    getWebsite(venue, user.isDemo),
    getLive(venue, now),
  ]);
  return {
    venue: { name: venue.name, slug: venue.slug, website: venue.website, timezone: venue.timezone, bookingProvider: (isProvider(venue.bookingProvider) ? venue.bookingProvider : "native"), bookingUrl: venue.bookingUrl },
    user: { name: user.name, isDemo: user.isDemo },
    sample: venue.sampleData,
    nextBrief: nextBriefLabel(now, venue.timezone),
    now: now.toISOString(),
    firstLink: `${linkHost()}/${venue.slug}/ig`,
    ranges: Object.fromEntries(ranges),
    actions,
    website,
    live,
  };
}
