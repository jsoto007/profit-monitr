import type { Venue } from "@/generated/prisma/client";
import { realRange } from "./dashboard/real";
import { db } from "./db";
import { calendarDate, weekStart } from "./time";
import { fmt, linkHost, money } from "./util";

/**
 * The Monday brief for one venue, built from last week's own activity:
 * closes out last week's moves with their results, then writes the three
 * moves for the new week. Returns null when there was nothing to report.
 * Safe to run more than once — the (venue, week, rank) index makes it idempotent.
 */
export async function generateWeeklyBrief(venue: Venue, now = new Date()) {
  const tz = venue.timezone;
  const week = calendarDate(weekStart(now, tz), tz);
  const lastWeek = calendarDate(weekStart(now, tz, -1), tz);
  const data = await realRange(venue, "last", now);
  const active = data.channels.filter((c) => c.clicks || c.booked || c.door);
  if (!active.length) return null;
  const m = data.metrics;

  const mine = { venueId: venue.id, sample: false, weekStart: lastWeek };
  await db.action.updateMany({ where: { ...mine, status: "approved" }, data: { status: "done", result: `→ ${fmt(m.door)} guests at the door, ${money(m.revCents)} traced that week` } });
  await db.action.updateMany({ where: { ...mine, status: "open" }, data: { status: "skipped", result: "Skipped" } });

  const best = [...active].sort((a, b) => b.door - a.door)[0];
  const worst = active.filter((c) => c.clicks >= 50).sort((a, b) => a.rate - b.rate)[0];
  const nights = data.reservations.bars;
  const quiet = nights.reduce((a, b) => (b.value < a.value ? b : a), nights[0]);
  const rate = (r: number) => `${(r * 100).toFixed(1)}%`;

  const actions = [
    best.door
      ? { title: `Go again with ${best.name} this week`, description: `Code ${best.code} brought ${fmt(best.door)} guests${best.clicks ? ` at a ${rate(best.rate)} click-to-door rate` : ""} — your best source.`, estimate: best.revCents ? `It earned ${money(best.revCents)} last week` : "", tip: `going again with ${best.name}` }
      : { title: "Share your tracked link in your bio and stories", description: `Every click, booking and check-in from ${linkHost()}/${venue.slug}/ig shows up here next Monday.`, estimate: "", tip: "sharing your tracked link" },
    worst && worst.id !== best.id
      ? { title: `Fix or pause ${worst.name}`, description: `${fmt(worst.clicks)} clicks but only ${fmt(worst.door)} guests (${rate(worst.rate)}). Try a clearer offer or move the budget.`, estimate: "", tip: `fixing or pausing ${worst.name}` }
      : { title: "Give every promoter and influencer their own link and code", description: "You can only scale what you can measure. One link and one code each.", estimate: "", tip: "giving each promoter their own code" },
    { title: `Plan something for ${quiet.label}`, description: `${fmt(quiet.value)} bookings — your quietest night. A code with a small offer is a cheap test.`, estimate: "", tip: `planning something for ${quiet.label}` },
  ];

  const { count } = await db.action.createMany({
    data: actions.map((a, i) => ({ venueId: venue.id, sample: false, weekStart: week, rank: i + 1, ...a })),
    skipDuplicates: true,
  });
  // Guests credited to a link or code — a walk-in with no source is not "from your links".
  const door = active.reduce((s, c) => s + c.door, 0);
  return { created: count, door, revCents: m.revCents, actions };
}
