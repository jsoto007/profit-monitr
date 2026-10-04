import type { Venue } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { destinationLive, PROVIDERS, providerOf, type Fidelity } from "@/lib/destinations";
import { rangeLabel, rangeWindow, serviceDay, shortDate, weekStart, zonedParts, type RangeKey } from "@/lib/time";
import { deltaLabel, fmt, linkHost, money } from "@/lib/util";
import { channelVerdict } from "./sample";
import type { Bar, ChannelRow, ContentRow, LiveData, LiveEvent, RangeData, SortKey, Verdict, WebsiteData } from "./types";

/**
 * A venue's own numbers, measured from tracked clicks, bookings, imported
 * platform orders and door check-ins. Definitions:
 *   revenue    — amountCents of bookings credited to a link or code, counted
 *                when the money was actually taken: at the door for bookings
 *                made on Monitr's page (tickets there are pay-at-the-door), or
 *                when the platform charged for an imported paid order (paidAt).
 *                A booking that never arrives — or was never real — is never revenue
 *   res / tix  — reservations made / tickets sold in the range (by order time)
 *   door       — guests checked in during the range (or, for imported orders,
 *                marked attended by the platform)
 */

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type B = { channelId: string | null; contentId: string | null; kind: string; partySize: number; amountCents: number; date: Date; createdAt: Date; checkedInAt: Date | null; provider: string; paidAt: Date | null };

const revenueAt = (b: B) => b.paidAt ?? b.checkedInAt;
const within = (d: Date | null, from: Date, to: Date) => !!d && d >= from && d < to;
const sum = <T>(xs: T[], f: (x: T) => number) => xs.reduce((s, x) => s + f(x), 0);
/** Whole-percent share; only an exact match is allowed to read "100%". */
const ratio = (a: number, b: number) => {
  if (!b) return "—";
  const p = Math.round((a / b) * 100);
  return `${p === 100 && a < b ? 99 : p}%`;
};

function totals(bs: B[], from: Date, to: Date) {
  const earned = bs.filter((b) => within(revenueAt(b), from, to));
  const credited = earned.filter((b) => b.channelId);
  return {
    revCents: sum(credited, (b) => b.amountCents),
    allRevCents: sum(earned, (b) => b.amountCents),
    platformCents: sum(credited.filter((b) => b.paidAt), (b) => b.amountCents),
    doorCents: sum(credited.filter((b) => !b.paidAt), (b) => b.amountCents),
    unattributedCents: sum(earned.filter((b) => !b.channelId && b.provider !== "native"), (b) => b.amountCents),
    res: bs.filter((b) => b.kind === "RESERVATION" && within(b.createdAt, from, to)).length,
    tix: sum(bs.filter((b) => b.kind === "TICKET" && within(b.createdAt, from, to)), (b) => b.partySize),
    orders: bs.filter((b) => within(b.createdAt, from, to)).length,
    door: sum(bs.filter((b) => within(b.checkedInAt, from, to)), (b) => b.partySize),
  };
}

export async function realRange(venue: Venue, key: RangeKey, now: Date): Promise<RangeData> {
  const tz = venue.timezone;
  const w = rangeWindow(key, now, tz);
  const [channels, contents, bookings, clicks, events] = await Promise.all([
    db.channel.findMany({ where: { venueId: venue.id }, orderBy: { createdAt: "asc" } }),
    db.content.findMany({ where: { venueId: venue.id }, include: { channel: { select: { detail: true, name: true, destination: true } } }, orderBy: { createdAt: "asc" } }),
    db.booking.findMany({
      where: { venueId: venue.id, OR: [{ createdAt: { gte: w.prevFrom } }, { checkedInAt: { gte: w.prevFrom } }, { paidAt: { gte: w.prevFrom } }, { date: { gte: w.prevFrom } }] },
      select: { channelId: true, contentId: true, kind: true, partySize: true, amountCents: true, date: true, createdAt: true, checkedInAt: true, provider: true, paidAt: true },
    }),
    db.clickEvent.findMany({ where: { channel: { venueId: venue.id }, createdAt: { gte: w.from, lt: w.to } }, select: { channelId: true, contentId: true } }),
    db.event.findMany({ where: { venueId: venue.id, startsAt: { gte: now } }, orderBy: { startsAt: "asc" }, take: 3, include: { bookings: { select: { partySize: true } } } }),
  ]);

  const cur = totals(bookings, w.from, w.to);
  // A week in progress is compared with the same stretch of the week before, not the whole of it.
  const prevTo = key === "week" ? new Date(w.prevFrom.getTime() + (now.getTime() - w.from.getTime())) : w.prevTo;
  const prev = totals(bookings, w.prevFrom, prevTo);
  // Spend is a weekly figure per channel (real ad spend is not imported, so this is an estimate):
  // charge only the weeks a channel existed, and only the part of the current week that has passed.
  const weekEnds = key === "month" ? [1, 2, 3, 4].map((i) => weekStart(w.from, tz, i)) : [w.to];
  const thisWeek = { from: weekStart(now, tz), to: weekStart(now, tz, 1) };
  const elapsed = Math.min(1, Math.max(0, (now.getTime() - thisWeek.from.getTime()) / (thisWeek.to.getTime() - thisWeek.from.getTime())));
  const spendOf = (c: { weeklySpendCents: number; createdAt: Date }) => {
    let weeks = 0;
    for (const end of weekEnds) {
      if (c.createdAt >= end) continue;
      weeks += end > now ? elapsed : 1;
    }
    return Math.round(c.weeklySpendCents * weeks);
  };
  // Where a channel's link actually lands right now (a link to an unverified own site still lands on Monitr's page).
  const externalOf = (c: { destination: string }) => [c.destination, venue.bookingUrl].find((u) => destinationLive(u, venue.websiteVerified)) ?? "";
  // Spend on a source whose return cannot be measured here is left out of the return on marketing, not read as 0.0×.
  const importedInRange = bookings.some((b) => b.provider !== "native" && within(b.createdAt, w.from, w.to));
  const fidelityOf = (c: { destination: string }): Fidelity => (!externalOf(c) ? "exact" : importedInRange ? "platform" : "clicks");
  const spendCents = sum(channels.filter((c) => fidelityOf(c) !== "clicks"), spendOf);
  const roi = spendCents ? `${(cur.revCents / spendCents).toFixed(1)}×` : "—";

  // Revenue chart: one bar per day, or per Monday week for the month range.
  const monthly = key === "month";
  const bars: Bar[] = monthly
    ? [0, 1, 2, 3].map((i) => ({ label: shortDate(weekStart(w.from, tz, i), tz), value: 0 }))
    : DAY_LABELS.map((label) => ({ label, value: 0 }));
  // Week buckets are cut at local Mondays, so a DST week (167 h / 169 h) cannot shift an event.
  const mondays = [1, 2, 3].map((i) => weekStart(w.from, tz, i));
  const bucket = (d: Date) => (monthly ? mondays.filter((x) => d >= x).length : zonedParts(d, tz).dow);
  for (const b of bookings) {
    const at = revenueAt(b);
    if (b.channelId && within(at, w.from, w.to)) bars[bucket(at!)].value += b.amountCents;
  }
  const best = bars.reduce((a, b) => (b.value > a.value ? b : a), bars[0]);

  // Channels. A link that sends people to the venue's Posh / Eventbrite / Resy page
  // can prove its clicks here and nothing after them until that platform's orders
  // are imported, so such a source never earns a conversion-based verdict, never
  // ranks as "worst", and shows "—" where a rate or return would be invented.
  // Once an export is in, an external source is "platform" fidelity: its orders
  // (as the platform reports them) stand in for the door in the click-to-… rate.
  const rows: (ChannelRow & { spend: number; short: string })[] = channels.map((c) => {
    const mine = bookings.filter((b) => b.channelId === c.id);
    const t = totals(mine, w.from, w.to);
    const clickCount = clicks.filter((k) => k.channelId === c.id).length;
    const spend = spendOf(c);
    const external = externalOf(c);
    const fidelity = fidelityOf(c);
    const measured = fidelity !== "clicks";
    const converted = fidelity === "platform" ? t.orders : t.door;
    return {
      id: c.id, name: c.name, short: c.short || c.name, detail: c.detail, code: c.code,
      clicks: clickCount, booked: t.res + t.tix, door: t.door, revCents: t.revCents,
      roi: !measured ? "—" : spend ? `${(t.revCents / spend).toFixed(1)}×` : t.revCents ? "free" : "—",
      weak: measured && spend > 0 && t.revCents / spend < 1.5,
      rate: measured && clickCount ? converted / clickCount : 0,
      verdict: !measured ? (clickCount ? "Getting clicks" : "New") : channelVerdict(clickCount, converted),
      fidelity,
      provider: providerOf(external),
      destination: c.destination,
      spend,
    };
  });
  const active = rows.filter((r) => r.clicks || r.booked || r.door || r.revCents);
  const measurable = active.filter((r) => r.fidelity !== "clicks");
  const top = (f: (r: (typeof rows)[number]) => number) => [...active].sort((a, b) => f(b) - f(a))[0];
  const byRev = top((r) => r.revCents);
  const perDollar = [...active].filter((r) => r.spend && r.revCents).sort((a, b) => b.revCents / b.spend - a.revCents / a.spend)[0];
  const byDoor = top((r) => r.door);
  const byRate = [...measurable].filter((r) => r.clicks >= 10).sort((a, b) => b.rate - a.rate)[0];
  const worst = [...measurable].filter((r) => r.clicks >= 50).sort((a, b) => a.rate - b.rate)[0];
  const topClicks = [...active].filter((r) => r.fidelity === "clicks").sort((a, b) => b.clicks - a.clicks)[0];
  const link = `${linkHost()}/${venue.slug}/ig`;

  const byOrders = [...active].filter((r) => r.fidelity === "platform").sort((a, b) => b.booked - a.booked)[0];

  const why: string[] = [];
  if (byDoor?.door) why.push(`**${byDoor.name}** brought ${fmt(byDoor.door)} guests through the door — more than any other source.`);
  if (byOrders?.booked && byOrders !== byDoor) why.push(`**${byOrders.name}** brought ${fmt(byOrders.booked)} ${byOrders.booked === 1 ? "booking" : "bookings"} on ${PROVIDERS[byOrders.provider].label}, as its export reports.`);
  if (byRate && byRate.rate > 0) why.push(`**${byRate.name}** turned ${(byRate.rate * 100).toFixed(1)}% of clicks into ${byRate.fidelity === "platform" ? "orders" : "guests"}.`);
  if (worst && worst !== byRate && worst.rate < 0.035) why.push(`**${worst.name}** reached too wide an audience: ${fmt(worst.clicks)} clicks, ${fmt(worst.door)} guests.`);
  if (topClicks?.clicks) {
    const p = PROVIDERS[topClicks.provider];
    why.push(`**${topClicks.name}** sent ${fmt(topClicks.clicks)} people to your ${p.label} page${p.orders ? " — upload its orders and the bookings get credited here" : " — what happened after the click is on their side"}.`);
  }
  if (!why.length) why.push(`Nothing tracked in this period yet. Share **${link}** — every click, booking and guest at the door shows up here.`);

  const delta = deltaLabel(cur.revCents, prev.revCents);
  const versus = !delta ? "" : delta === "+0%" ? ", level with the period before" : ` and ${delta.slice(1)} ${delta.startsWith("−") ? "less" : "more"} than the period before`;
  const external = externalOf({ destination: "" });
  const summary = cur.revCents
    ? `${spendCents ? `That's ${roi} what you spent` : "All of it traced to your links and codes"}${versus}.`
    : external
      ? `No tracked sales in this period yet. Your links send people to ${PROVIDERS[providerOf(external)].label} — upload its orders and the sales show up here.`
      : `No tracked sales in this period yet. Share ${link} and the first booking will show up here.`;

  const sortNotes: Record<SortKey, string> = active.length
    ? {
        clicks: `By clicks, ${top((r) => r.clicks).name} looks like your star.`,
        door: byDoor?.door ? `By guests at the door, ${byDoor.name} leads.` : "No guests checked in yet.",
        rev: byRev?.revCents ? `${byRev.name} earns the most.` : "No revenue traced yet.",
        rate: byRate ? `${byRate.name} turns ${(byRate.rate * 100).toFixed(1)}% of clicks into guests.` : "Not enough clicks to compare conversion yet.",
      }
    : { clicks: "Share your links to start ranking channels.", door: "Share your links to start ranking channels.", rev: "Share your links to start ranking channels.", rate: "Share your links to start ranking channels." };

  // Content. A piece under a clicks-only channel can prove no more than its channel can: never "Fix or cut".
  const content: ContentRow[] = contents
    .map((c) => {
      const mine = bookings.filter((b) => b.contentId === c.id);
      const t = totals(mine, w.from, w.to);
      const clickCount = clicks.filter((k) => k.contentId === c.id).length;
      const measuredHere = fidelityOf(c.channel) !== "clicks";
      const rate = measuredHere && clickCount ? t.door / clickCount : 0;
      const verdict: Verdict = rate >= 0.06 ? "Scale it" : measuredHere && clickCount >= 50 && rate < 0.035 ? "Fix or cut" : "Keep going";
      return { id: c.id, name: c.name, channel: c.channel.detail || c.channel.name, door: t.door, revCents: t.revCents, perGuestCents: t.door ? Math.round(t.revCents / t.door) : 0, verdict };
    })
    .sort((a, b) => b.revCents - a.revCents);

  // Reservations: bookings by the night they are for.
  const resBars: Bar[] = bars.map((b) => ({ label: b.label, value: 0 }));
  for (const b of bookings) if (within(b.date, w.from, w.to)) resBars[bucket(b.date)].value += 1;
  // "Due" = booked for a time that has passed, or already arrived (guests can turn up early).
  // Show rate is a door measurement: only bookings made on Monitr's page count, because an
  // imported order's attendance is whatever the platform reported — often nothing at all.
  const due = bookings.filter((b) => b.provider === "native" && within(b.date, w.from, w.to) && (b.date < now || b.checkedInAt));
  const dueGuests = sum(due, (b) => b.partySize);
  const arrived = sum(due.filter((b) => b.checkedInAt), (b) => b.partySize);
  const quiet = !monthly && resBars.some((b) => b.value) ? resBars.reduce((a, b) => (b.value < a.value ? b : a), resBars[0]) : null;

  const upcoming = events.map((ev) => {
    const sold = sum(ev.bookings, (b) => b.partySize);
    const p = ev.capacity ? Math.min(100, Math.round((sold / ev.capacity) * 100)) : 0;
    const soon = ev.startsAt.getTime() - now.getTime() < 7 * 86_400_000;
    const when = soon ? ev.startsAt.toLocaleDateString("en-US", { timeZone: tz, weekday: "short" }) : shortDate(ev.startsAt, tz);
    const left = Math.max(0, ev.capacity - sold);
    const unit = ev.kind === "TICKET" ? "sold" : "booked";
    // An event created from an imported export carries no capacity: say what sold, not a made-up percentage.
    if (!ev.capacity) return { id: ev.id, when: `${when} · ${ev.name}`, headline: `${fmt(sold)} ${unit}`, pct: 0, note: "capacity not set" };
    return { id: ev.id, when: `${when} · ${ev.name}`, headline: `${p}% ${unit}`, pct: p, note: ev.kind === "TICKET" ? `${fmt(left)} tickets left` : `${fmt(left)} seats open` };
  });

  return {
    metrics: {
      range: key,
      rangeLabel: monthly ? "LAST 4 WEEKS" : rangeLabel(w.from, w.to, tz),
      revCents: cur.revCents, res: cur.res, tix: cur.tix, door: cur.door,
      spendCents, roi,
      deltas: { rev: delta, res: deltaLabel(cur.res, prev.res), tix: deltaLabel(cur.tix, prev.tix), door: deltaLabel(cur.door, prev.door) },
      showRate: ratio(arrived, dueGuests),
      shareOfSales: ratio(cur.revCents, cur.allRevCents),
      revPerGuest: cur.door ? money(cur.allRevCents / cur.door) : "—",
      revPerGuestNote: "all sales ÷ guests at the door",
      noShowRate: dueGuests ? `${100 - Math.round((arrived / dueGuests) * 100)}%` : "—",
      noShowNote: dueGuests ? `${fmt(dueGuests - arrived)} of ${fmt(dueGuests)} guests` : "no past bookings yet",
      chart: {
        title: monthly ? "Revenue by week" : "Revenue by day",
        note: best.value ? `${best.label} · ${money(best.value)}` : "No tracked sales yet",
        bars,
      },
      summary,
      why,
      revenueHeadline: byRev?.revCents
        ? `${byRev.short} brought the most money.${perDollar ? ` ${perDollar.short} brought the most per dollar.` : ""}`
        : "No marketing revenue traced yet.",
      platformCents: cur.platformCents,
      doorCents: cur.doorCents,
      unattributedCents: cur.unattributedCents,
    },
    channels: rows.map((r) => ({ id: r.id, name: r.name, detail: r.detail, code: r.code, clicks: r.clicks, booked: r.booked, door: r.door, revCents: r.revCents, roi: r.roi, weak: r.weak, rate: r.rate, verdict: r.verdict, fidelity: r.fidelity, provider: r.provider, destination: r.destination })),
    sortNotes,
    content,
    reservations: {
      bars: resBars,
      quietNote: quiet ? `${quiet.label} is your quiet night` : "",
      // A clicks-only source has no bookings to show here — it is not "0 bookings", it is unmeasured.
      sources: rows.filter((r) => r.fidelity !== "clicks").sort((a, b) => b.booked - a.booked).slice(0, 5).map((r) => ({ id: r.id, name: r.name, booked: r.booked, door: r.door })),
      upcoming,
    },
  };
}

type LiveBooking = { id: string; kind: string; partySize: number; amountCents: number; date: Date; createdAt: Date; checkedInAt: Date | null; channel: { name: string; detail: string; code: string } | null; event: { name: string } | null };

const source = (b: LiveBooking) => (b.channel ? `${b.channel.detail || b.channel.name} · code ${b.channel.code}` : "Direct booking");

/**
 * A booking becomes up to two feed events: when it was made and when the party
 * arrived. `tonight` says whether the booking is for the venue's current day,
 * i.e. whether it adds to "expected" on the Live screen.
 */
export function bookingEvents(b: LiveBooking, tonight: (d: Date) => boolean): LiveEvent[] {
  const out: LiveEvent[] = [];
  const ticket = b.kind === "TICKET";
  out.push({
    id: `${b.id}-made`, k: ticket ? "tix" : "book",
    txt: ticket ? `${b.partySize} ticket${b.partySize === 1 ? "" : "s"} · ${b.event?.name ?? "Tickets"}` : `Table for ${b.partySize} booked`,
    src: source(b), amountCents: 0, n: b.partySize, at: b.createdAt.toISOString(), tonight: tonight(b.date),
  });
  if (b.checkedInAt) {
    out.push({ id: `${b.id}-door`, k: "door", txt: `Party of ${b.partySize} checked in`, src: source(b), amountCents: b.amountCents, n: b.partySize, at: b.checkedInAt.toISOString() });
  }
  return out;
}

const LIVE_INCLUDE = { channel: { select: { name: true, detail: true, code: true } }, event: { select: { name: true } } } as const;

const tonightIn = (tz: string, now: Date) => {
  const { from, to } = serviceDay(now, tz);
  return (d: Date) => d >= from && d < to;
};

/**
 * Bookings made or checked in after `since`, as feed events (oldest first).
 * Imported orders stay out of the live feed — an upload is history, not a
 * night in progress — but they count in every total.
 */
export async function realEventsSince(venue: Pick<Venue, "id" | "timezone">, since: Date, now = new Date()): Promise<LiveEvent[]> {
  const rows = await db.booking.findMany({
    where: { venueId: venue.id, provider: "native", OR: [{ createdAt: { gt: since } }, { checkedInAt: { gt: since } }] },
    include: LIVE_INCLUDE,
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const tonight = tonightIn(venue.timezone, now);
  return rows
    .flatMap((b) => bookingEvents(b, tonight))
    .filter((e) => new Date(e.at) > since)
    .sort((a, b) => a.at.localeCompare(b.at));
}

export async function realLive(venue: Venue, now: Date, note: LiveData["note"]): Promise<LiveData> {
  const tz = venue.timezone;
  const { from, to } = serviceDay(now, tz);
  const rows = await db.booking.findMany({
    where: { venueId: venue.id, OR: [{ createdAt: { gte: from } }, { checkedInAt: { gte: from } }, { date: { gte: from, lt: to } }] },
    include: LIVE_INCLUDE,
  });
  const t = totals(rows, from, to);
  const arrivals = rows.filter((b) => within(b.checkedInAt, from, to));
  const bySource = new Map<string, { name: string; code: string; guests: number }>();
  for (const b of arrivals) {
    if (!b.channel) continue;
    const cur = bySource.get(b.channelId!) ?? { name: b.channel.detail || b.channel.name, code: b.channel.code, guests: 0 };
    cur.guests += b.partySize;
    bySource.set(b.channelId!, cur);
  }
  const lead = [...bySource.values()].sort((a, b) => b.guests - a.guests)[0];
  const hours: Bar[] = ["5p", "6p", "7p", "8p", "9p", "10p", "11p"].map((label) => ({ label, value: 0 }));
  for (const b of arrivals) {
    const h = zonedParts(b.checkedInAt!, tz).h;
    if (h >= 17 && h <= 23) hours[h - 17].value += b.partySize;
  }
  return {
    revCents: t.allRevCents,
    bookings: t.res,
    tickets: t.tix,
    door: t.door,
    expected: sum(rows.filter((b) => within(b.date, from, to)), (b) => b.partySize),
    traced: ratio(t.revCents, t.allRevCents),
    top: lead ? { name: lead.name, note: `${fmt(lead.guests)} guests · code ${lead.code}` } : { name: "—", note: "No check-ins yet tonight" },
    feed: rows.filter((b) => b.provider === "native").flatMap((b) => bookingEvents(b, (d) => within(d, from, to))).filter((e) => new Date(e.at) >= from).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8),
    hours,
    note,
  };
}

/** No agent has scanned a real venue's site yet — say so rather than invent numbers. */
export function realWebsite(site: string, recs: WebsiteData["recs"]): WebsiteData {
  const pending = "first scan pending";
  return {
    site: site || "add your website",
    kpis: [
      { label: "Local search rank", value: "—", note: pending, highlight: true },
      { label: "SEO health", value: "—", note: pending },
      { label: "Page speed", value: "—", note: pending },
      { label: "AI assistants recommending you", value: "—", note: pending },
    ],
    agents: [
      { name: "SEO agent", status: "Setting up", tone: "lavender", body: "Will fix broken pages, add event schema and watch your local keywords.", foot: "Starts after your site is connected" },
      { name: "Website agent", status: "Setting up", tone: "lavender", body: "Will compress images, keep the booking button one tap away and check every page nightly on mobile.", foot: "Starts after your site is connected" },
      { name: "Reservations agent", status: "Setting up", tone: "lavender", body: "Will send reminders, fill cancellations from the waitlist and flag quiet nights early.", foot: "Starts with your first bookings" },
    ],
    recs,
  };
}
