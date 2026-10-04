import { beforeEach, describe, expect, it } from "vitest";
import { FormError, HttpError } from "@/lib/api";
import { checkIn, createBooking, releaseBooking, ticketAmountCents } from "@/lib/bookings";
import { generateWeeklyBrief } from "@/lib/brief";
import { getActions, getDashboard, getLive, getRange, getWebsite } from "@/lib/dashboard";
import { approveAction, approveAgentNote, approveRecommendation, chooseBookingPage, requestExpert, setBookingPage, setChannelDestination, setSampleData } from "@/lib/dashboard/mutations";
import { realEventsSince } from "@/lib/dashboard/real";
import { db } from "@/lib/db";
import { importOrders } from "@/lib/imports";
import { signup } from "@/lib/signup";
import { serviceDay, zonedParts } from "@/lib/time";
import { money } from "@/lib/util";
import { destinationFor, GET as redirectGet, HEAD as redirectHead } from "@/app/r/[venue]/[...path]/route";
import { makeAccount, resetDb } from "../helpers";

beforeEach(resetDb);

const reload = async (id: string) => {
  const u = await db.user.findUniqueOrThrow({ where: { id }, include: { venue: true } });
  return u as typeof u & { venue: NonNullable<typeof u.venue> };
};
const NY = "America/New_York";
const pad = (n: number) => String(n).padStart(2, "0");
/** A booking slot inside the venue's current service day, whatever hour the suite runs at. */
const tonight = () => {
  const p = zonedParts(new Date(), NY);
  return { date: `${p.y}-${pad(p.m)}-${pad(p.d)}`, time: `${pad(p.h)}:${pad(p.min)}` };
};
const today = () => tonight().date;

describe("sample mode", () => {
  it("serves the handoff's dashboard to a new venue, under its own name", async () => {
    const user = await makeAccount({ venue: "Test Kitchen & Bar", website: "testkitchen.example" });
    const d = await getDashboard(user);
    expect(d.sample).toBe(true);
    expect([d.venue.name, d.user.name, d.firstLink]).toEqual(["Test Kitchen & Bar", "Dana Test", "monitr.link/test-kitchen-bar/ig"]);
    expect(money(d.ranges.week!.metrics.revCents)).toBe("$48,920");
    expect(Object.keys(d.ranges)).toEqual(["week", "last", "month"]);
    expect(d.actions.weekLabel).toBe("WEEK OF SEP 28");
    expect(d.actions.current.map((a) => a.title)).toEqual(["Rebook @maria.eats before Saturday", "Pause the paid ad and put $1,500 into a Jazz Night email", "Send a Tuesday 2-for-1 to your email list"]);
    expect(d.actions.past.map((p) => p.done)).toEqual([true, true, false]);
    expect(d.website.site).toBe("testkitchen.example");
    expect(d.website.recs).toHaveLength(3);
    expect(d.live.note?.sent).toBe(false);
  });
});

describe("owner decisions", () => {
  it("approving an action persists and is idempotent", async () => {
    const user = await makeAccount();
    const [first] = (await getActions(user.venue)).current;
    expect(await approveAction(user, first.id)).toEqual({ ok: true, changed: true });
    expect(await approveAction(user, first.id)).toEqual({ ok: true, changed: false });
    expect((await getActions(user.venue)).current.map((a) => a.approved)).toEqual([true, false, false]);
  });

  it("ten simultaneous approvals change the row exactly once", async () => {
    const user = await makeAccount();
    const [first] = (await getActions(user.venue)).current;
    const results = await Promise.all(Array.from({ length: 10 }, () => approveAction(user, first.id)));
    expect(results.filter((r) => r.changed)).toHaveLength(1);
  });

  it("cannot touch another venue's rows", async () => {
    const [mine, theirs] = [await makeAccount(), await makeAccount()];
    const [action] = (await getActions(theirs.venue)).current;
    const [rec] = (await getWebsite(theirs.venue, false)).recs;
    await expect(approveAction(mine, action.id)).rejects.toMatchObject({ status: 404 });
    await expect(approveRecommendation(mine, rec.id)).rejects.toMatchObject({ status: 404 });
    expect((await getActions(theirs.venue)).current[0].approved).toBe(false);
  });

  it("recommendations, the agent note and the expert request each record once", async () => {
    const user = await makeAccount();
    const [rec] = (await getWebsite(user.venue, false)).recs;
    expect((await approveRecommendation(user, rec.id)).changed).toBe(true);
    expect((await getWebsite(user.venue, false)).recs[0].approved).toBe(true);

    const note = (await getLive(user.venue)).note!;
    expect((await approveAgentNote(user, note.id)).changed).toBe(true);
    expect((await approveAgentNote(user, note.id)).changed).toBe(false);
    expect((await getLive(user.venue)).note!.sent).toBe(true);

    const taps = await Promise.all([requestExpert(user), requestExpert(user), requestExpert(user)]);
    expect(taps.filter((t) => t.changed)).toHaveLength(1);
    expect(await db.expertRequest.count({ where: { venueId: user.venue.id } })).toBe(1);
    expect((await getActions(user.venue)).expertRequested).toBe(true);
  });

  it("the shared demo account is read-only on the server", async () => {
    const demo = await makeAccount({ isDemo: true });
    const [first] = (await getActions(demo.venue)).current;
    expect(await approveAction(demo, first.id)).toEqual({ ok: true, changed: false });
    expect(await requestExpert(demo)).toEqual({ ok: true, changed: false });
    expect(await setSampleData(demo, false)).toEqual({ ok: true, changed: false });
    expect((await getActions(demo.venue)).current[0].approved).toBe(false);
    expect(await db.expertRequest.count()).toBe(0);
  });
});

describe("attribution loop on real data", () => {
  it("click → booking → door check-in shows up as revenue credited to the link", async () => {
    let user = await makeAccount({ venue: "Loop Room" });
    await setSampleData(user, false);
    user = await reload(user.id);
    const ig = await db.channel.findFirstOrThrow({ where: { venueId: user.venue.id, slug: "ig" } });
    await db.clickEvent.createMany({ data: Array.from({ length: 20 }, () => ({ channelId: ig.id })) });

    const { booking } = await createBooking({ venue: "loop-room", via: "ig", name: "Sam Guest", party: 4, ...tonight() });
    expect([booking.channelId, booking.promoCode, booking.amountCents, booking.kind]).toEqual([ig.id, "INSTA", 0, "RESERVATION"]);
    // Booked but not arrived: no revenue, no guests at the door yet.
    let m = (await getRange(user.venue, "week")).metrics;
    expect([m.res, m.door, m.revCents]).toEqual([1, 0, 0]);

    expect(await checkIn(user.venue.id, booking.confirmation.toLowerCase(), "212.40")).toMatchObject({ guestName: "Sam Guest", partySize: 4, promoCode: "INSTA" });
    const d = await getRange(user.venue, "week");
    m = d.metrics;
    expect([m.res, m.door, m.revCents, m.shareOfSales, m.showRate]).toEqual([1, 4, 21_240, "100%", "100%"]);
    expect(d.channels.find((c) => c.code === "INSTA")).toMatchObject({ clicks: 20, booked: 1, door: 4, revCents: 21_240, verdict: "Working", roi: "free" });
    expect(m.chart.bars.reduce((s, b) => s + b.value, 0)).toBe(21_240);
    expect(m.why[0]).toContain("**Instagram** brought 4 guests");

    const live = await getLive(user.venue);
    expect([live.door, live.revCents, live.bookings, live.expected, live.traced]).toEqual([4, 21_240, 1, 4, "100%"]);
    expect(live.feed.map((e) => e.k)).toEqual(["door", "book"]);
    expect(live.top).toEqual({ name: "Instagram · bio link", note: "4 guests · code INSTA" });
  });

  it("a party can only be checked in once, however many times the code is scanned", async () => {
    const user = await makeAccount({ venue: "Double Scan" });
    const real = { ...user.venue, sampleData: false };
    // Eight simultaneous scans with no bill: one arrival, seven refusals.
    const a = (await createBooking({ venue: "double-scan", code: "insta", name: "Sam Guest", party: 3, date: today() })).booking;
    const bare = await Promise.allSettled(Array.from({ length: 8 }, () => checkIn(user.venue.id, a.confirmation)));
    expect(bare.filter((s) => s.status === "fulfilled")).toHaveLength(1);
    for (const s of bare) if (s.status === "rejected") expect(s.reason).toMatchObject({ status: 409 });
    // Eight simultaneous scans carrying the bill: still one arrival; the rest only re-save the same bill.
    const b = (await createBooking({ venue: "double-scan", code: "insta", name: "Ana Guest", party: 2, date: today() })).booking;
    const billed = await Promise.all(Array.from({ length: 8 }, () => checkIn(user.venue.id, b.confirmation, "90.00")));
    expect(billed.filter((r) => !r.billUpdated)).toHaveLength(1);
    const m = (await getRange(real, "week")).metrics;
    expect([m.door, m.revCents]).toEqual([5, 9_000]);
  });

  it("rejects a malformed bill instead of guessing, and another venue's code", async () => {
    const [user, other] = [await makeAccount({ venue: "Bill Check" }), await makeAccount()];
    const { booking } = await createBooking({ venue: "bill-check", name: "Sam Guest", party: 2, date: today() });
    await expect(checkIn(user.venue.id, booking.confirmation, "12.345")).rejects.toBeInstanceOf(FormError);
    await expect(checkIn(user.venue.id, booking.confirmation, "-5")).rejects.toBeInstanceOf(FormError);
    await expect(checkIn(other.venue.id, booking.confirmation)).rejects.toMatchObject({ status: 404 });
    expect((await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).checkedInAt).toBeNull();
    // No bill is fine: the party still counts at the door.
    await checkIn(user.venue.id, booking.confirmation);
    expect((await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).amountCents).toBe(0);
  });

  it("validates the public booking form and unknown promo codes", async () => {
    await makeAccount({ venue: "Form Check" });
    await expect(createBooking({ venue: "nowhere", name: "Sam" })).rejects.toBeInstanceOf(HttpError);
    const err = await createBooking({ venue: "form-check", name: "S", party: 0, date: "soon" }).catch((e) => e);
    expect(Object.keys(err.fields).sort()).toEqual(["date", "name", "party"]);
    await expect(createBooking({ venue: "form-check", name: "Sam Guest", party: 2, date: today(), code: "NOPE" })).rejects.toMatchObject({ fields: { code: "That code isn't valid for this venue." } });
  });

  it("tickets: price × quantity in cents, the last ticket is sold exactly once, and nothing is revenue until the door", async () => {
    const user = await makeAccount({ venue: "Jazz Cellar" });
    const event = await db.event.create({ data: { venueId: user.venue.id, name: "Jazz Night", kind: "TICKET", capacity: 5, priceCents: 3_500, startsAt: new Date(Date.now() + 3 * 86_400_000) } });
    const { booking } = await createBooking({ venue: "jazz-cellar", via: "email", kind: "TICKET", eventId: event.id, name: "Ana", party: 2 });
    expect([booking.amountCents, booking.kind, booking.date.getTime()]).toEqual([7_000, "TICKET", event.startsAt.getTime()]);

    // Three tickets remain; four buyers each want two.
    const rush = await Promise.allSettled(Array.from({ length: 4 }, (_, i) => createBooking({ venue: "jazz-cellar", kind: "TICKET", eventId: event.id, name: `Buyer ${i}`, party: 2 })));
    expect(rush.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const sold = await db.booking.aggregate({ where: { eventId: event.id }, _sum: { partySize: true } });
    expect(sold._sum.partySize).toBe(4);
    await expect(createBooking({ venue: "jazz-cellar", kind: "TICKET", eventId: event.id, name: "Late", party: 2 })).rejects.toMatchObject({ fields: { party: "Only 1 left." } });

    // An order is a hold, not a sale: no payment was taken, so it is not revenue yet.
    const real = { ...user.venue, sampleData: false };
    let d = await getRange(real, "week");
    expect([d.metrics.tix, d.metrics.revCents, d.metrics.door]).toEqual([4, 0, 0]);
    expect((await getLive(real)).revCents).toBe(0);
    expect(d.reservations.upcoming[0]).toMatchObject({ when: expect.stringContaining("Jazz Night"), headline: "80% sold", note: "1 tickets left" });

    // At the door the ticket money is taken: counted once, credited to the channel that sold it.
    await expect(checkIn(user.venue.id, booking.confirmation, "70.00")).rejects.toMatchObject({ fields: { amount: expect.stringContaining("Tickets are priced") } });
    await checkIn(user.venue.id, booking.confirmation);
    d = await getRange(real, "week");
    expect([d.metrics.revCents, d.metrics.door]).toEqual([7_000, 2]);
    expect(d.channels.find((c) => c.code === "EMAIL")).toMatchObject({ revCents: 7_000, door: 2 });
  });

  it("an order can hold at most ten tickets, quantities must be whole numbers, and a no-show can be released", async () => {
    const user = await makeAccount({ venue: "Hold Room" });
    const event = await db.event.create({ data: { venueId: user.venue.id, name: "Late Show", kind: "TICKET", capacity: 12, priceCents: 5_000, startsAt: new Date(Date.now() + 86_400_000) } });
    const order = (party: unknown) => createBooking({ venue: "hold-room", kind: "TICKET", eventId: event.id, name: "No Body", party: party as number });
    await expect(order(40)).rejects.toMatchObject({ fields: { party: "Up to 10 tickets per order." } });
    for (const bad of [2.5, 0.5, "3", true, "0x10", -1, 0]) await expect(order(bad)).rejects.toBeInstanceOf(FormError);
    const { booking } = await order(10);
    await expect(order(3)).rejects.toMatchObject({ fields: { party: "Only 2 left." } });

    // Another venue cannot release it; the owner can, and the seats go back on sale.
    const other = await makeAccount();
    await expect(releaseBooking(other.venue.id, booking.confirmation)).rejects.toMatchObject({ status: 404 });
    expect(await releaseBooking(user.venue.id, booking.confirmation)).toEqual({ released: true });
    const again = await order(3);
    // A party that has arrived can never be released.
    await checkIn(user.venue.id, again.booking.confirmation);
    await expect(releaseBooking(user.venue.id, again.booking.confirmation)).rejects.toMatchObject({ status: 409 });
    expect(await db.booking.count({ where: { eventId: event.id } })).toBe(1);
  });

  it("a promo discount is applied to the ticket total in whole cents, in the guest's favour", async () => {
    expect([ticketAmountCents(3_500, 2, 10), ticketAmountCents(3_333, 1, 15), ticketAmountCents(999, 3, 33), ticketAmountCents(3_500, 2, null)]).toEqual([6_300, 2_833, 2_007, 7_000]);
    const user = await makeAccount({ venue: "Promo Room" });
    await db.channel.updateMany({ where: { venueId: user.venue.id, slug: "ig" }, data: { discountPct: 10 } });
    const event = await db.event.create({ data: { venueId: user.venue.id, name: "Jazz Night", kind: "TICKET", capacity: 50, priceCents: 3_500, startsAt: new Date(Date.now() + 86_400_000) } });
    const { booking, discountPct } = await createBooking({ venue: "promo-room", via: "ig", kind: "TICKET", eventId: event.id, name: "Ana", party: 2 });
    expect([booking.amountCents, discountPct]).toEqual([6_300, 10]); // what the guest is told is what is recorded
  });

  it("a table's bill can be added or corrected after check-in, without counting the party again", async () => {
    const user = await makeAccount({ venue: "Bill Fix" });
    const real = { ...user.venue, sampleData: false };
    const { booking } = await createBooking({ venue: "bill-fix", via: "ig", name: "Sam Guest", party: 4, ...tonight() });
    await checkIn(user.venue.id, booking.confirmation); // tapped in with no bill
    expect((await getRange(real, "week")).metrics.revCents).toBe(0);
    expect(await checkIn(user.venue.id, booking.confirmation, "18450")).toMatchObject({ billUpdated: true, amountCents: 1_845_000 }); // typo: meant 184.50
    expect(await checkIn(user.venue.id, booking.confirmation, "184.50")).toMatchObject({ billUpdated: true, amountCents: 18_450 });
    const m = (await getRange(real, "week")).metrics;
    expect([m.revCents, m.door, m.revPerGuest]).toEqual([18_450, 4, "$46"]);
    // A comma typed as the decimal mark is refused, not read as $18,450.
    await expect(checkIn(user.venue.id, booking.confirmation, "184,50")).rejects.toBeInstanceOf(FormError);
    expect((await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).amountCents).toBe(18_450);
  });

  it("a typed promo code beats the link, a wrong one is refused, and a released booking cannot be billed", async () => {
    const user = await makeAccount({ venue: "Code Room", promos: ["Influencers"] });
    await db.channel.updateMany({ where: { venueId: user.venue.id, slug: "influencers" }, data: { discountPct: 20 } });
    const event = await db.event.create({ data: { venueId: user.venue.id, name: "Jazz Night", kind: "TICKET", capacity: 50, priceCents: 3_500, startsAt: new Date(Date.now() + 86_400_000) } });
    const order = (extra: object) => createBooking({ venue: "code-room", kind: "TICKET", eventId: event.id, name: "Ana", party: 2, ...extra });
    const typed = await order({ via: "ig", code: "vip" }); // arrived on the Instagram link, typed the influencer's code
    expect([typed.booking.amountCents, typed.booking.promoCode, typed.discountPct]).toEqual([5_600, "VIP", 20]);
    await expect(order({ via: "ig", code: "NOPE" })).rejects.toMatchObject({ fields: { code: "That code isn't valid for this venue." } });
    expect((await order({ via: "ig" })).booking.promoCode).toBe("INSTA");

    const table = (await createBooking({ venue: "code-room", name: "Sam Guest", party: 2, ...tonight() })).booking;
    await expect(checkIn(user.venue.id, table.confirmation, ["184.50"])).rejects.toBeInstanceOf(FormError); // not silently a $0 check-in
    expect((await db.booking.findUniqueOrThrow({ where: { id: table.id } })).checkedInAt).toBeNull();
    await releaseBooking(user.venue.id, table.confirmation);
    await expect(checkIn(user.venue.id, table.confirmation, "184.50")).rejects.toMatchObject({ status: 404 });
  });

  it("refuses impossible and far-off dates, and bookings for the shared demo venue", async () => {
    await makeAccount({ venue: "Date Check" });
    const book = (date: string) => createBooking({ venue: "date-check", name: "Sam Guest", party: 2, date });
    await expect(book("2027-02-31")).rejects.toMatchObject({ fields: { date: "That date doesn’t exist." } });
    await expect(book("9999-12-31")).rejects.toMatchObject({ fields: { date: "Bookings open up to a year ahead." } });
    await expect(book("2020-01-01")).rejects.toMatchObject({ fields: { date: "That date has passed." } });
    expect(await db.booking.count()).toBe(0);
    const demo = await makeAccount({ venue: "Demo Room", isDemo: true });
    await expect(createBooking({ venue: demo.venue.slug, name: "FREE BOTTLE", party: 40, date: today() })).rejects.toMatchObject({ status: 403 });
  });

  it("\"tonight\" runs past midnight, and marketing spend is not charged for weeks before a link existed", async () => {
    const lateNight = new Date("2026-10-04T04:10:00Z"); // Sun 12:10 am in New York
    const { from, to } = serviceDay(lateNight, NY);
    expect([from.toISOString(), to.toISOString()]).toEqual(["2026-10-03T09:00:00.000Z", "2026-10-04T09:00:00.000Z"]); // Sat 5 am → Sun 5 am

    const user = await makeAccount({ venue: "Spend Room" });
    await db.channel.updateMany({ where: { venueId: user.venue.id, slug: "ig" }, data: { weeklySpendCents: 70_000 } });
    const real = { ...user.venue, sampleData: false };
    const [week, last, month] = await Promise.all([getRange(real, "week"), getRange(real, "last"), getRange(real, "month")]);
    expect(last.metrics.spendCents).toBe(0); // the link was created today
    expect(week.metrics.spendCents).toBeGreaterThan(0);
    expect(week.metrics.spendCents).toBeLessThanOrEqual(70_000); // only the part of this week that has passed
    expect(month.metrics.spendCents).toBe(week.metrics.spendCents); // not four weeks of spend
  });

  it("streams only what happened after the cursor", async () => {
    const user = await makeAccount({ venue: "Stream Room" });
    const before = new Date(Date.now() - 1000);
    const { booking } = await createBooking({ venue: "stream-room", via: "ig", name: "Sam Guest", party: 2, ...tonight() });
    const made = await realEventsSince(user.venue, before);
    expect(made.map((e) => [e.k, e.txt, e.src, e.tonight])).toEqual([["book", "Table for 2 booked", "Instagram · bio link · code INSTA", true]]);
    const cursor = new Date(made[0].at);
    expect(await realEventsSince(user.venue, cursor)).toEqual([]);
    await checkIn(user.venue.id, booking.confirmation, "80");
    expect((await realEventsSince(user.venue, cursor)).map((e) => [e.k, e.amountCents])).toEqual([["door", 8_000]]);
  });
});

describe("overlay: links that land on the venue's own platform", () => {
  const ctx = (venue: string, path: string[]) => ({ params: Promise.resolve({ venue, path }) });
  const req = (method = "GET", agent = "Mozilla/5.0 (iPhone)") => new Request("http://localhost:10000/r/x/y", { method, headers: { host: "app.test", "user-agent": agent, "cf-connecting-ip": "203.0.113.9" } });

  it("sends people to the channel's own link, else the venue's booking page, else Monitr's page — and still counts the click", async () => {
    let user = await makeAccount({ venue: "Overlay Bar" });
    const ig = await db.channel.findFirstOrThrow({ where: { venueId: user.venue.id, slug: "ig" } });
    const email = await db.channel.findFirstOrThrow({ where: { venueId: user.venue.id, slug: "email" } });

    // Native: the redirect lands on Monitr's own booking page with the source attached.
    let res = await redirectGet(req(), ctx("overlay-bar", ["ig"]));
    expect([res.status, res.headers.get("location")]).toEqual([302, "http://app.test/book/overlay-bar?via=ig"]);

    // The venue books on Posh: every link goes there.
    expect(await setBookingPage(user, "posh", "https://posh.vip/e/sunset")).toEqual({ ok: true, changed: true });
    expect(await setBookingPage(user, "posh", "https://posh.vip/e/sunset")).toEqual({ ok: true, changed: false });
    res = await redirectGet(req(), ctx("overlay-bar", ["ig"]));
    expect(res.headers.get("location")).toBe("https://posh.vip/e/sunset");

    // One promoter has their own Eventbrite tracking link: it wins, and Eventbrite's aff carries the channel.
    expect(await setChannelDestination(user, email.id, "https://www.eventbrite.com/e/jazz-123")).toEqual({ ok: true, changed: true });
    res = await redirectGet(req(), ctx("overlay-bar", ["email"]));
    expect(res.headers.get("location")).toBe("https://www.eventbrite.com/e/jazz-123?aff=email");
    // HEAD (link checkers) goes to the same place without counting; the one GET per visitor counted once each.
    const head = await redirectHead(req("HEAD"), ctx("overlay-bar", ["email"]));
    expect(head.headers.get("location")).toBe("https://www.eventbrite.com/e/jazz-123?aff=email");
    await redirectGet(req("GET", "facebookexternalhit/1.1"), ctx("overlay-bar", ["email"])); // unfurler
    expect(await db.clickEvent.count({ where: { channelId: ig.id } })).toBe(1);
    expect(await db.clickEvent.count({ where: { channelId: email.id } })).toBe(1);

    // Pure resolution, no database: content keeps riding on the native page only.
    user = await reload(user.id);
    const r = new Request("http://localhost/r", { headers: { host: "app.test" } });
    expect(destinationFor(r, { channel: { slug: "ig", destination: "" }, venue: { slug: "overlay-bar", bookingUrl: "", websiteVerified: false }, content: { slug: "reel" } }).toString()).toBe("http://app.test/book/overlay-bar?via=ig&c=reel");
    expect(destinationFor(r, { channel: { slug: "ig", destination: "" }, venue: { slug: "overlay-bar", bookingUrl: user.venue.bookingUrl, websiteVerified: false }, content: { slug: "reel" } }).toString()).toBe("https://posh.vip/e/sunset");
    // A stored destination that no longer parses falls through to Monitr's page rather than a 500.
    expect(destinationFor(r, { channel: { slug: "ig", destination: "" }, venue: { slug: "overlay-bar", bookingUrl: "https://", websiteVerified: false } }).toString()).toBe("http://app.test/book/overlay-bar?via=ig");
  });

  it("a clicks-only source never earns a conversion verdict, never ranks worst, and the brief asks for the platform's orders instead", async () => {
    let user = await makeAccount({ venue: "Posh Nights" });
    await setSampleData(user, false);
    await setBookingPage(user, "posh", "https://posh.vip/e/late");
    user = await reload(user.id);
    const ig = await db.channel.findFirstOrThrow({ where: { venueId: user.venue.id, slug: "ig" } });
    const lastWeek = new Date(Date.now() - 7 * 86_400_000);
    await db.clickEvent.createMany({ data: Array.from({ length: 60 }, () => ({ channelId: ig.id })) });
    await db.clickEvent.createMany({ data: Array.from({ length: 80 }, () => ({ channelId: ig.id, createdAt: lastWeek })) });

    const d = await getRange(user.venue, "week");
    const row = d.channels.find((c) => c.code === "INSTA")!;
    expect(row).toMatchObject({ clicks: 60, door: 0, revCents: 0, rate: 0, roi: "—", weak: false, verdict: "Getting clicks", fidelity: "clicks", provider: "posh", destination: "" });
    expect(d.metrics.why[0]).toBe("**Instagram** sent 60 people to your Posh page — upload its orders and the bookings get credited here.");
    expect(d.sortNotes.rate).toBe("Not enough clicks to compare conversion yet."); // never "turns 0.0% of clicks into guests"

    const brief = await generateWeeklyBrief(user.venue);
    expect(brief!.actions.map((a) => a.title)).toEqual(["Upload last week's Posh orders", "Give every promoter and influencer their own link and code", expect.stringMatching(/^Plan something for/)]);
    expect(brief!.actions.some((a) => a.title.startsWith("Fix or pause"))).toBe(false);
  });

  it("destinations are validated at write time and scoped to the owner's venue", async () => {
    const [mine, theirs] = [await makeAccount(), await makeAccount()];
    const myIg = await db.channel.findFirstOrThrow({ where: { venueId: mine.venue.id, slug: "ig" } });
    await expect(setChannelDestination(theirs, myIg.id, "https://posh.vip/e/x")).rejects.toMatchObject({ status: 404 });
    await expect(setChannelDestination(mine, "nope", "https://posh.vip/e/x")).rejects.toMatchObject({ status: 404 });
    expect((await db.channel.findUniqueOrThrow({ where: { id: myIg.id } })).destination).toBe("");
    const demo = await makeAccount({ isDemo: true });
    expect(await setBookingPage(demo, "posh", "https://posh.vip/e/x")).toEqual({ ok: true, changed: false });
    expect((await reload(demo.id)).venue.bookingUrl).toBe("");
  });

  it("sign-up stores where guests book, in canonical form, and refuses a page off the allow-list", async () => {
    const base = { name: "Dana Test", password: "correct horse 9!", vtype: "Nightclub", city: "Brooklyn, NY", website: "", sells: ["Event tickets"], promos: [], agree: true };
    const posh = await signup({ ...base, email: "posh@example.test", venue: "Posh Venue", bookingProvider: "posh", bookingUrl: "posh.vip/e/late " });
    expect((await reload(posh.id)).venue).toMatchObject({ bookingProvider: "posh", bookingUrl: "https://posh.vip/e/late" });
    // "My own website" with the website field empty: the pasted page is the website.
    const own = await signup({ ...base, email: "own@example.test", venue: "Own Site", bookingProvider: "website", bookingUrl: "https://www.ownsite.example/book" });
    expect((await reload(own.id)).venue).toMatchObject({ bookingProvider: "website", bookingUrl: "https://www.ownsite.example/book", website: "www.ownsite.example" });
    const bad = await signup({ ...base, email: "bad@example.test", venue: "Bad Link", bookingProvider: "resy", bookingUrl: "https://evil.example/phish" }).catch((e) => e);
    expect(Object.keys(bad.fields)).toEqual(["bookingUrl"]);
    const none = await signup({ ...base, email: "none@example.test", venue: "No Link", bookingProvider: "eventbrite", bookingUrl: "" }).catch((e) => e);
    expect(none.fields).toEqual({ bookingUrl: "Paste the page where guests book." });
    // Unknown provider or no provider: Monitr's own page, no URL kept.
    const native = await signup({ ...base, email: "native@example.test", venue: "Native", bookingProvider: "ticketmaster", bookingUrl: "https://posh.vip/e/ignored" });
    expect((await reload(native.id)).venue).toMatchObject({ bookingProvider: "native", bookingUrl: "" });
  });
});

describe("own-site links wait for verification; content under an external link is never 'Fix or cut'", () => {
  const ctx = (venue: string, path: string[]) => ({ params: Promise.resolve({ venue, path }) });
  const req = () => new Request("http://localhost:10000/r/x/y", { method: "GET", headers: { host: "app.test", "user-agent": "Mozilla/5.0 (iPhone)", "cf-connecting-ip": "203.0.113.9" } });

  it("adopts the pasted site as the venue's website, keeps links on Monitr's page until verified, then sends them on", async () => {
    let user = await makeAccount({ venue: "Own Site Bar", website: "" });
    await expect(chooseBookingPage(user, "resy", "", [])).rejects.toMatchObject({ fields: { bookingUrl: "Paste the page where guests book." } });
    await expect(chooseBookingPage(user, "website", "https://bit.ly/ownsite", [])).rejects.toMatchObject({ fields: { bookingUrl: expect.stringContaining("Shortened") } });
    const chosen = await chooseBookingPage(user, "website", "www.ownsite.example/book", []);
    expect(chosen).toMatchObject({ changed: true, bookingProvider: "website", bookingUrl: "https://www.ownsite.example/book", website: "www.ownsite.example", websiteVerified: false });
    user = await reload(user.id);
    expect([user.venue.website, user.venue.bookingUrl, user.venue.websiteVerified]).toEqual(["www.ownsite.example", "https://www.ownsite.example/book", false]);

    // Not yet verified: the link still lands on Monitr's page, and the channel is still "exact".
    let res = await redirectGet(req(), ctx("own-site-bar", ["ig"]));
    expect(res.headers.get("location")).toBe("http://app.test/book/own-site-bar?via=ig");
    const real = { ...user.venue, sampleData: false };
    expect((await getRange(real, "week")).channels.find((c) => c.code === "INSTA")).toMatchObject({ fidelity: "exact", provider: "native" });

    // The operator verifies the site (README → "Verifying a venue's website").
    await db.venue.update({ where: { id: user.venue.id }, data: { websiteVerified: true } });
    res = await redirectGet(req(), ctx("own-site-bar", ["ig"]));
    expect(res.headers.get("location")).toBe("https://www.ownsite.example/book");
    user = await reload(user.id);
    expect((await getRange({ ...user.venue, sampleData: false }, "week")).channels.find((c) => c.code === "INSTA")).toMatchObject({ fidelity: "clicks", provider: "website" });

    // Back to Monitr's page clears it; a platform page needs no verification.
    expect(await chooseBookingPage(user, "native", "", [])).toMatchObject({ bookingProvider: "native", bookingUrl: "" });
    expect(await chooseBookingPage(user, "posh", "posh.vip/e/x", [])).toMatchObject({ bookingProvider: "posh", bookingUrl: "https://posh.vip/e/x" });
    res = await redirectGet(req(), ctx("own-site-bar", ["ig"]));
    expect(res.headers.get("location")).toBe("https://posh.vip/e/x");
  });

  it("a post under a clicks-only channel gets 'Keep going', and the spend on it stays out of the return on marketing", async () => {
    let user = await makeAccount({ venue: "Content Bar" });
    await setSampleData(user, false);
    await setBookingPage(user, "posh", "https://posh.vip/e/late");
    user = await reload(user.id);
    const ig = await db.channel.findFirstOrThrow({ where: { venueId: user.venue.id, slug: "ig" } });
    await db.channel.update({ where: { id: ig.id }, data: { weeklySpendCents: 50_000 } });
    const reel = await db.content.create({ data: { venueId: user.venue.id, channelId: ig.id, name: "Sunset reel", slug: "reel" } });
    await db.clickEvent.createMany({ data: Array.from({ length: 60 }, () => ({ channelId: ig.id, contentId: reel.id })) });
    const d = await getRange(user.venue, "week");
    expect(d.content[0]).toMatchObject({ name: "Sunset reel", door: 0, verdict: "Keep going" });
    expect([d.metrics.spendCents, d.metrics.roi]).toEqual([0, "—"]); // never "0.0×" on spend whose return cannot be seen here
    expect(d.reservations.sources.find((s) => s.name === "Instagram")).toBeUndefined(); // not "0 bookings · 0 in": unmeasured
    expect(d.metrics.summary).toContain("Your links send people to Posh");
  });
});

describe("imported platform orders", () => {
  const stamp = (d: Date) => {
    const p = zonedParts(d, NY);
    return `${p.y}-${pad(p.m)}-${pad(p.d)} ${pad(p.h)}:${pad(p.min)}`;
  };
  const HEAD = "Order #,Order Date,First Name,Last Name,Email,Quantity,Total Paid,Order Status,Promo Code,Affiliate,Event Name,Event Date,Checked In";
  const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

  it("credits each order to its code or link, recognises revenue when the platform took it, and never counts a re-upload twice", async () => {
    let user = await makeAccount({ venue: "Import Bar", promos: ["Instagram", "Email"] });
    await setSampleData(user, false);
    await setBookingPage(user, "eventbrite", "https://www.eventbrite.com/e/jazz-123");
    user = await reload(user.id);
    const ordered = stamp(daysAgo(3));
    const night = stamp(new Date(Date.now() + 86_400_000));
    const file = (status1001 = "Attending") => [
      HEAD,
      `1001,${ordered},Ana,Guest,ana@x.test,2,$60.00,${status1001},INSTA,,Jazz Night,${night},No`,
      `1002,${ordered},Bo,Guest,bo@x.test,1,40.00,Attending,,email,Jazz Night,${night},Yes`,
      `1003,${ordered},Cy,Guest,cy@x.test,1,25.00,Attending,,,Jazz Night,${night},No`,
      `1004,${ordered},Di,Guest,di@x.test,1,15.00,Refunded,INSTA,,Jazz Night,${night},No`,
      "oops,not a date,X,Y,x@y.test,1,10.00,Attending,,,,,",
    ].join("\n");

    // Dry run: everything is reported, nothing is written.
    const dry = await importOrders(user, "eventbrite", file(), "orders.csv", true);
    expect(dry).toMatchObject({ rows: 4, created: 4, updated: 0, rejected: 1, attributed: 3, unattributed: 1, refunded: 1, revenueCents: 12_500, missing: [] });
    expect(dry.byChannel).toEqual([{ name: "Instagram", orders: 2, revenueCents: 6_000 }, { name: "Email", orders: 1, revenueCents: 4_000 }]);
    expect(await db.booking.count()).toBe(0);

    const done = await importOrders(user, "eventbrite", file(), "orders.csv", false);
    expect([done.created, done.updated]).toEqual([4, 0]);
    const rows = await db.booking.findMany({ where: { venueId: user.venue.id }, orderBy: { externalId: "asc" } });
    // Attendance in the file ("Yes" on 1002) is never written as a door check-in.
    expect(rows.map((r) => [r.externalId, r.provider, r.kind, r.amountCents, r.partySize, r.promoCode, !!r.channelId, r.paidAt?.getTime() === r.createdAt.getTime(), !!r.checkedInAt])).toEqual([
      ["1001", "eventbrite", "TICKET", 6_000, 2, "INSTA", true, true, false],
      ["1002", "eventbrite", "TICKET", 4_000, 1, "EMAIL", true, true, false],
      ["1003", "eventbrite", "TICKET", 2_500, 1, "", false, true, false],
      ["1004", "eventbrite", "TICKET", 0, 0, "INSTA", true, false, false], // refunded: no money, no tickets
    ]);
    expect(done.attended).toBe(1);
    // The door never works an imported order: it cannot be checked in, billed or released.
    await expect(checkIn(user.venue.id, rows[0].confirmation, "10.00")).rejects.toMatchObject({ status: 404 });
    await expect(releaseBooking(user.venue.id, rows[0].confirmation)).rejects.toMatchObject({ status: 404 });
    expect(await db.booking.count({ where: { venueId: user.venue.id } })).toBe(4);
    expect(rows[0].createdAt.getTime()).toBe(daysAgo(3).getTime() - (daysAgo(3).getTime() % 60_000)); // the order's own time, to the minute
    expect(await db.event.count({ where: { venueId: user.venue.id, externalId: { not: null }, capacity: 0 } })).toBe(1);

    // Revenue in the period the platform took it (3 days ago), split from the door, with the loose $25 named.
    const d = await getRange(user.venue, "month");
    const m = d.metrics;
    expect([m.revCents, m.platformCents, m.doorCents, m.unattributedCents, m.tix]).toEqual([10_000, 10_000, 0, 2_500, 4]);
    expect([m.showRate, m.noShowRate]).toEqual(["—", "—"]); // attendance is the platform's word, not a door measurement
    expect(d.channels.find((c) => c.code === "INSTA")).toMatchObject({ booked: 2, revCents: 6_000, fidelity: "platform", provider: "eventbrite", roi: "free" });
    expect(d.channels.find((c) => c.code === "EMAIL")).toMatchObject({ booked: 1, revCents: 4_000, fidelity: "platform" });
    expect(d.reservations.upcoming[0]).toMatchObject({ when: expect.stringContaining("Jazz Night"), headline: "4 sold", note: "capacity not set" });
    expect((await getLive(user.venue)).feed).toEqual([]); // uploads are history, not tonight's feed

    // The same file again: the index decides, nothing doubles.
    const again = await importOrders(user, "eventbrite", file(), "orders.csv", false);
    expect([again.created, again.updated]).toEqual([0, 4]);
    expect((await getRange(user.venue, "month")).metrics.revCents).toBe(10_000);

    // A later export carries a refund for 1001: its money goes, the row stays, the count of orders does not change.
    await importOrders(user, "eventbrite", file("Refunded"), "orders-later.csv", false);
    expect((await getRange(user.venue, "month")).metrics.revCents).toBe(4_000);
    expect(await db.booking.count({ where: { venueId: user.venue.id } })).toBe(4);
    expect(await db.import.count({ where: { venueId: user.venue.id } })).toBe(3);
    // The old file uploaded again does not bring the refund back.
    const stale = await importOrders(user, "eventbrite", file(), "orders.csv", false);
    expect([stale.keptRefunded, stale.updated]).toEqual([1, 3]);
    expect((await getRange(user.venue, "month")).metrics.revCents).toBe(4_000);
    // The brief ranks the platform bookings when the door has nothing: Email (1 order, $40) is now best.
    const b2 = await generateWeeklyBrief(user.venue, new Date(Date.now() + 7 * 86_400_000));
    expect(b2!.actions[0].title).toBe("Go again with Email this week");
    expect(b2!.actions[0].description).toContain("1 bookings on Eventbrite");
    const brief = await generateWeeklyBrief(user.venue, new Date(Date.now() + 7 * 86_400_000));
    expect(brief).toMatchObject({ platformCents: 4_000, doorCents: 0, unattributedCents: 2_500 });
  });

  it("refuses the demo venue and a file without an order id, and cannot touch another venue's rows", async () => {
    const demo = await makeAccount({ isDemo: true });
    await expect(importOrders(demo, "posh", "Order ID,Date\n1,2026-09-26", "x.csv", false)).rejects.toMatchObject({ status: 403 });
    const user = await makeAccount({ venue: "No Id Bar" });
    const s = await importOrders(user, "posh", "Buyer,Amount\nAna,10", "x.csv", false);
    expect(s.missing).toEqual(["id", "date"]);
    expect(await db.booking.count()).toBe(0);
    const other = await makeAccount({ venue: "Other Bar" });
    await importOrders(user, "posh", `Order ID,Date,Name,Tickets,Total\n7,${stamp(new Date())},Ana Guest,1,10.00`, "x.csv", false);
    expect(await db.booking.count({ where: { venueId: other.venue.id } })).toBe(0);
    expect(await db.booking.count({ where: { venueId: user.venue.id, provider: "posh", externalId: "7" } })).toBe(1);
    // The same platform order id at another venue is another row; a native booking is never touched by any upload.
    await importOrders(other, "posh", `Order ID,Date,Name,Tickets,Total\n7,${stamp(new Date())},Zed Guest,1,10.00`, "x.csv", false);
    expect(await db.booking.count({ where: { provider: "posh", externalId: "7" } })).toBe(2);
  });
});

describe("weekly brief", () => {
  it("writes three moves from last week's activity, once, and closes out the week before", async () => {
    let user = await makeAccount({ venue: "Brief Bar" });
    await setSampleData(user, false);
    user = await reload(user.id);
    expect(await generateWeeklyBrief(user.venue)).toBeNull(); // nothing happened → nothing to send

    const ig = await db.channel.findFirstOrThrow({ where: { venueId: user.venue.id, slug: "ig" } });
    const lastWeek = new Date(Date.now() - 7 * 86_400_000);
    await db.clickEvent.createMany({ data: Array.from({ length: 60 }, () => ({ channelId: ig.id, createdAt: lastWeek })) });
    await db.booking.create({ data: { venueId: user.venue.id, channelId: ig.id, kind: "RESERVATION", confirmation: "BRI-AAAAA", guestName: "Past Guest", partySize: 6, date: lastWeek, createdAt: lastWeek, checkedInAt: lastWeek, amountCents: 30_000, promoCode: "INSTA" } });

    // A walk-in with no link or code arrived too; the email must not claim those guests for marketing.
    await db.booking.create({ data: { venueId: user.venue.id, kind: "RESERVATION", confirmation: "BRI-BBBBB", guestName: "Walk In", partySize: 5, date: lastWeek, createdAt: lastWeek, checkedInAt: lastWeek, amountCents: 20_000 } });

    const brief = await generateWeeklyBrief(user.venue);
    expect(brief).toMatchObject({ created: 3, door: 6, revCents: 30_000 });
    expect(brief!.actions[0].title).toBe("Go again with Instagram this week");
    expect((await generateWeeklyBrief(user.venue))!.created).toBe(0); // idempotent
    const actions = await getActions(user.venue);
    expect(actions.current).toHaveLength(3);
    expect(actions.current.every((a) => !a.approved)).toBe(true);
  });
});
