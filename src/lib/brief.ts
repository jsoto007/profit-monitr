import type { Venue } from "@/generated/prisma/client";
import { realRange } from "./dashboard/real";
import { db } from "./db";
import { PROVIDERS } from "./destinations";
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

  // A source whose link lands on Posh / Eventbrite / Resy proves its clicks and nothing
  // after them, so it is never "best" by the door and never "worst" by conversion.
  const measurable = active.filter((c) => c.fidelity !== "clicks");
  // What a source delivered: guests at the door, or — for a platform source — the bookings its export reports.
  const delivered = (c: (typeof active)[number]) => (c.fidelity === "platform" ? c.booked : c.door);
  const unit = (c: (typeof active)[number]) => (c.fidelity === "platform" ? "bookings" : "guests");
  const best = [...measurable].sort((a, b) => delivered(b) - delivered(a))[0] ?? active[0];
  const worst = measurable.filter((c) => c.clicks >= 50).sort((a, b) => a.rate - b.rate)[0];
  const topClicks = active.filter((c) => c.fidelity === "clicks").sort((a, b) => b.clicks - a.clicks)[0];
  const nights = data.reservations.bars;
  const quiet = nights.reduce((a, b) => (b.value < a.value ? b : a), nights[0]);
  const rate = (r: number) => `${(r * 100).toFixed(1)}%`;

  const platform = topClicks ? PROVIDERS[topClicks.provider] : null;
  const upload = topClicks && platform?.orders
    ? { title: `Upload last week's ${platform.label} orders`, description: `${topClicks.name} sent ${fmt(topClicks.clicks)} people to your ${platform.label} page. Upload its orders export and next Monday the brief credits every booking to the code or link that earned it.`, estimate: "", tip: `uploading your ${platform.label} orders` }
    : null;
  const share = { title: "Share your tracked link in your bio and stories", description: `Every click, booking and check-in from ${linkHost()}/${venue.slug}/ig shows up here next Monday.`, estimate: "", tip: "sharing your tracked link" };
  const codes = { title: "Give every promoter and influencer their own link and code", description: "You can only scale what you can measure. One link and one code each.", estimate: "", tip: "giving each promoter their own code" };

  const first = best && delivered(best)
    ? {
        title: `Go again with ${best.name} this week`,
        description: `Code ${best.code} brought ${fmt(delivered(best))} ${unit(best)}${best.fidelity === "platform" ? ` on ${PROVIDERS[best.provider].label}` : ""}${best.clicks ? ` at a ${rate(best.rate)} click-to-${best.fidelity === "platform" ? "order" : "door"} rate` : ""} — your best source.`,
        estimate: best.revCents ? `It earned ${money(best.revCents)} last week` : "",
        tip: `going again with ${best.name}`,
      }
    : (upload ?? share);
  const second = worst && worst.id !== best?.id
    ? { title: `Fix or pause ${worst.name}`, description: `${fmt(worst.clicks)} clicks but only ${fmt(delivered(worst))} ${unit(worst)} (${rate(worst.rate)}). Try a clearer offer or move the budget.`, estimate: "", tip: `fixing or pausing ${worst.name}` }
    : (upload && upload !== first ? upload : codes);
  const actions = [
    first,
    second,
    { title: `Plan something for ${quiet.label}`, description: `${fmt(quiet.value)} bookings — your quietest night. A code with a small offer is a cheap test.`, estimate: "", tip: `planning something for ${quiet.label}` },
  ];

  const { count } = await db.action.createMany({
    data: actions.map((a, i) => ({ venueId: venue.id, sample: false, weekStart: week, rank: i + 1, ...a })),
    skipDuplicates: true,
  });
  // Guests and bookings credited to a link or code — a walk-in with no source is not "from your links".
  const door = active.reduce((s, c) => s + c.door, 0);
  const booked = active.reduce((s, c) => s + c.booked, 0);
  return { created: count, door, booked, revCents: m.revCents, platformCents: m.platformCents, doorCents: m.doorCents, unattributedCents: m.unattributedCents, actions };
}
