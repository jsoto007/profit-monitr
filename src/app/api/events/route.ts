import { NextResponse } from "next/server";
import { FormError, handler, readJson, str } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { assertNotDemo } from "@/lib/dashboard/request";
import { db } from "@/lib/db";
import { parseDollars } from "@/lib/util";

/** Keeps price × quantity far inside a 32-bit integer of cents. */
const MAX_PRICE_CENTS = 1_000_000;

type Body = { name?: string; startsAt?: string; kind?: string; capacity?: number; price?: string | number };

/** POST /api/events — a ticketed night or bookable service that shows under "Coming up". */
export const POST = handler(async (req: Request) => {
  const user = await requireUser();
  assertNotDemo(user);
  const b = await readJson<Body>(req);
  const name = str(b.name, 80);
  const startsAt = new Date(str(b.startsAt, 40));
  const capacity = typeof b.capacity === "number" && Number.isInteger(b.capacity) ? b.capacity : NaN;
  const kind = b.kind === "RESERVATION" ? "RESERVATION" : "TICKET";
  const price = b.price === undefined || b.price === "" ? 0 : parseDollars(b.price);
  const e: Record<string, string> = {};
  if (name.length < 2) e.name = "Name the event.";
  if (isNaN(startsAt.getTime())) e.startsAt = "Use an ISO date-time, e.g. 2026-10-31T21:00:00-05:00.";
  if (!(capacity >= 1 && capacity <= 100_000)) e.capacity = "How many tickets or seats?";
  if (price === null) e.price = "Enter dollars and cents, e.g. 35.00.";
  else if (price > MAX_PRICE_CENTS) e.price = "Ticket prices go up to $10,000.";
  if (Object.keys(e).length) throw new FormError(e);
  const ev = await db.event.create({ data: { venueId: user.venue.id, name, startsAt, kind, capacity, priceCents: price ?? 0 } });
  return NextResponse.json({ ok: true, event: { id: ev.id } }, { status: 201 });
});
