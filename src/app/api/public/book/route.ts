import { NextResponse } from "next/server";
import { clientKey, handler, HttpError, readJson, str } from "@/lib/api";
import { createBooking, type BookingBody } from "@/lib/bookings";
import { blocked, rateLimit, spend } from "@/lib/rate-limit";

/** POST /api/public/book — the venue's public booking page. No sign-in; limited per caller and per venue. */
export const POST = handler(async (req: Request) => {
  rateLimit(`book:${clientKey(req)}`, 10, 60_000);
  const body = await readJson<BookingBody>(req);
  // A venue-wide ceiling on bookings actually made — refused requests do not use it up.
  const venueKey = `booked:${str(body.venue, 60)}`;
  if (blocked(venueKey, 60)) throw new HttpError(429, "This venue is taking a lot of bookings right now. Please try again in a minute.");
  const { booking, discountPct } = await createBooking(body);
  spend(venueKey, 60_000);
  return NextResponse.json({ ok: true, confirmation: booking.confirmation, discountPct, amountCents: booking.amountCents, date: booking.date.toISOString() });
});
