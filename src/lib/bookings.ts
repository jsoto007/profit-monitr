import { FormError, HttpError, str } from "./api";
import { db, isUniqueViolation } from "./db";
import { confirmationCode } from "./password";
import { zonedParts, zonedTimeToUtc } from "./time";
import { cleanCode, EMAIL_RE, parseDollars } from "./util";

export type BookingBody = {
  venue?: string;
  /** channel slug from the tracked link */
  via?: string;
  /** content slug from the tracked link */
  c?: string;
  kind?: string;
  eventId?: string;
  name?: string;
  email?: string;
  party?: number;
  date?: string;
  time?: string;
  code?: string;
};

export const MAX_PARTY = 40;
/** Tickets are held without payment (pay at the door), so one order can only hold a few. */
export const MAX_TICKETS = 10;
const MAX_DAYS_AHEAD = 366;

/** Price × quantity less a percentage, in integer cents. A fraction of a cent goes to the guest. */
export function ticketAmountCents(priceCents: number, quantity: number, discountPct: number | null): number {
  const gross = priceCents * quantity;
  return discountPct ? Math.floor((gross * (100 - discountPct)) / 100) : gross;
}

/**
 * A guest books a table or tickets from the venue's public page. The booking
 * is credited to the tracked link that brought them (`via`) or, failing that,
 * the promo code they typed. No money moves here: a ticket order records what
 * will be owed at the door, and nothing counts as revenue until check-in.
 */
export async function createBooking(b: BookingBody) {
  const venue = await db.venue.findUnique({ where: { slug: str(b.venue, 60) }, include: { user: { select: { isDemo: true } } } });
  if (!venue) throw new HttpError(404, "Venue not found.");
  // The demo venue is shared by every visitor; it must not collect real names or bookings.
  if (venue.user.isDemo) throw new HttpError(403, "This is a demo venue — it doesn’t take real bookings.");

  const e: Record<string, string> = {};
  const name = str(b.name, 120);
  const email = str(b.email, 200).toLowerCase();
  const kind = b.kind === "TICKET" ? "TICKET" : "RESERVATION";
  const max = kind === "TICKET" ? MAX_TICKETS : MAX_PARTY;
  const party = typeof b.party === "number" && Number.isInteger(b.party) ? b.party : NaN;
  if (name.length < 2) e.name = "Enter your name.";
  if (email && !EMAIL_RE.test(email)) e.email = "Enter a valid email.";
  if (!(party >= 1)) e.party = kind === "TICKET" ? "How many tickets?" : "How many guests?";
  else if (party > max) e.party = kind === "TICKET" ? `Up to ${max} tickets per order.` : `Up to ${max} guests — call us for larger parties.`;

  // Tickets are for a specific event; a reservation is a calendar day and time in the venue's zone.
  const event = kind === "TICKET" ? await db.event.findFirst({ where: { id: str(b.eventId, 40), venueId: venue.id, kind: "TICKET" } }) : null;
  let date: Date | null = null;
  if (kind === "TICKET") {
    if (!event) e.eventId = "Pick an event.";
    else if (event.startsAt < new Date()) e.eventId = "That event has already started.";
    else date = event.startsAt;
  } else {
    const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str(b.date, 10));
    const t = /^(\d{2}):(\d{2})$/.exec(str(b.time, 5) || "19:00");
    if (!d) e.date = "Pick a date.";
    else if (!t || +t[1] > 23 || +t[2] > 59) e.time = "Pick a time.";
    else {
      date = zonedTimeToUtc(+d[1], +d[2], +d[3], +t[1], +t[2], venue.timezone);
      const back = zonedParts(date, venue.timezone);
      // Feb 31 must not quietly become Mar 3, and nobody books a table for the year 9999.
      if (back.y !== +d[1] || back.m !== +d[2] || back.d !== +d[3]) e.date = "That date doesn’t exist.";
      else if (date.getTime() < Date.now() - 86_400_000) e.date = "That date has passed.";
      else if (date.getTime() > Date.now() + MAX_DAYS_AHEAD * 86_400_000) e.date = "Bookings open up to a year ahead.";
    }
  }
  if (Object.keys(e).length) throw new FormError(e);

  const code = cleanCode(str(b.code, 12));
  const via = str(b.via, 60);
  // A code the guest typed is explicit, so it wins over the link they arrived on (the form
  // pre-fills the link's own code, so normally they agree). A typed code must be valid.
  const byCode = code ? await db.channel.findFirst({ where: { venueId: venue.id, code, active: true } }) : null;
  if (code && !byCode) throw new FormError({ code: "That code isn't valid for this venue." });
  const channel = byCode ?? (via ? await db.channel.findFirst({ where: { venueId: venue.id, slug: via, active: true } }) : null);
  const contentSlug = str(b.c, 60);
  const content = channel && contentSlug ? await db.content.findFirst({ where: { channelId: channel.id, slug: contentSlug } }) : null;

  const prefix = venue.slug.replace(/[^a-z0-9]/g, "").slice(0, 3).toUpperCase() || "PM";
  const data = {
    venueId: venue.id, channelId: channel?.id ?? null, contentId: content?.id ?? null, eventId: event?.id ?? null,
    kind, guestName: name, guestEmail: email, partySize: party, date: date!, promoCode: channel?.code ?? "",
    amountCents: event ? ticketAmountCents(event.priceCents, party, channel?.discountPct ?? null) : 0,
  };

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const booking = await db.$transaction(async (tx) => {
        if (event) {
          // Capacity gate: lock the event row, then count — two buyers cannot both take the last ticket.
          await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${event.id} FOR UPDATE`;
          const sold = await tx.booking.aggregate({ where: { eventId: event.id }, _sum: { partySize: true } });
          const left = event.capacity - (sold._sum.partySize ?? 0);
          if (party > left) throw new FormError({ party: left > 0 ? `Only ${left} left.` : "Sold out." });
        }
        return tx.booking.create({ data: { ...data, confirmation: confirmationCode(prefix) } });
      });
      return { venue, booking, discountPct: channel?.discountPct ?? null };
    } catch (err) {
      if (!isUniqueViolation(err)) throw err; // confirmation code collided — draw another
    }
  }
  throw new HttpError(503, "Could not complete the booking. Please try again.");
}

/**
 * Door check-in. One conditional UPDATE decides: only a booking that has not
 * arrived yet can be checked in, so a double scan can never count a party
 * twice. Arrival is when money is taken, so it is also when revenue counts:
 * a table's bill is whatever staff enter (now, or later as a correction);
 * a ticket order's amount was fixed when it was booked.
 */
export async function checkIn(venueId: string, rawConfirmation: unknown, rawAmount?: unknown) {
  const confirmation = str(rawConfirmation, 20).toUpperCase();
  if (!confirmation) throw new HttpError(422, "Enter the confirmation code.");
  if (rawAmount != null && typeof rawAmount !== "string" && typeof rawAmount !== "number") throw new FormError({ amount: "Enter the bill as dollars and cents, e.g. 184.50." });
  const hasAmount = typeof rawAmount === "number" || (typeof rawAmount === "string" && rawAmount.trim() !== "");
  const amountCents = hasAmount ? parseDollars(rawAmount) : null;
  if (hasAmount && amountCents === null) throw new FormError({ amount: "Enter the bill as dollars and cents, e.g. 184.50." });

  // Only bookings made on Monitr's page are worked at Monitr's door: an imported platform order
  // is scanned on its platform, its money is already recognised, and it must never be released.
  const booking = await db.booking.findFirst({ where: { venueId, confirmation, provider: "native" } });
  if (!booking) throw new HttpError(404, "No booking with that confirmation code.");
  if (booking.kind === "TICKET" && amountCents !== null) throw new FormError({ amount: "Tickets are priced when they’re booked — leave the bill empty." });

  const bill = amountCents !== null ? { amountCents } : {};
  const who = { guestName: booking.guestName, partySize: booking.partySize, promoCode: booking.promoCode, kind: booking.kind };
  const { count } = await db.booking.updateMany({ where: { id: booking.id, checkedInAt: null }, data: { checkedInAt: new Date(), ...bill } });
  if (count) return { ...who, billUpdated: false, amountCents: amountCents ?? booking.amountCents };
  // Already in. A bill can still be added or corrected — the arrival is never recorded twice.
  if (amountCents === null) throw new HttpError(409, `${booking.guestName} already checked in.`);
  const saved = await db.booking.updateMany({ where: { id: booking.id, checkedInAt: { not: null } }, data: bill });
  // Zero rows: the booking was released by someone else at this very moment.
  if (!saved.count) throw new HttpError(404, "That booking was just released.");
  return { ...who, billUpdated: true, amountCents };
}

/**
 * Releases a booking that has not arrived (a no-show, a duplicate, a prank):
 * its seats or tickets go back on sale. A party that has checked in cannot be
 * released — that would erase a guest and their bill from the record.
 */
export async function releaseBooking(venueId: string, rawConfirmation: unknown) {
  const confirmation = str(rawConfirmation, 20).toUpperCase();
  const { count } = await db.booking.deleteMany({ where: { venueId, confirmation, checkedInAt: null, provider: "native" } });
  if (count) return { released: true };
  const exists = await db.booking.findFirst({ where: { venueId, confirmation, provider: "native" }, select: { id: true } });
  throw new HttpError(exists ? 409 : 404, exists ? "That party has already checked in." : "No booking with that confirmation code.");
}
