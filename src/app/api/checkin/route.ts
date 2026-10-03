import { NextResponse } from "next/server";
import { handler, readJson, str } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { checkIn, releaseBooking } from "@/lib/bookings";
import { assertNotDemo } from "@/lib/dashboard/request";
import { db } from "@/lib/db";

/**
 * POST /api/checkin { confirmation, amount? } — a party arrives. This is what
 * turns a click into a "guest at the door" and into revenue. For a table,
 * `amount` is the bill; sending it again later corrects it.
 */
export const POST = handler(async (req: Request) => {
  const user = await requireUser();
  assertNotDemo(user);
  const b = await readJson<{ confirmation?: string; amount?: string }>(req);
  return NextResponse.json({ ok: true, ...(await checkIn(user.venue.id, b.confirmation, b.amount)) });
});

/** DELETE /api/checkin { confirmation } — release a booking that has not arrived; its seats go back on sale. */
export const DELETE = handler(async (req: Request) => {
  const user = await requireUser();
  assertNotDemo(user);
  const b = await readJson<{ confirmation?: string }>(req);
  return NextResponse.json({ ok: true, ...(await releaseBooking(user.venue.id, b.confirmation)) });
});

/**
 * GET /api/checkin[?q=] — the door list. Without a search: every booking still
 * to arrive from yesterday onwards (soonest first — this is also where held
 * tickets are found and released), then recent arrivals. `q` searches all
 * bookings by confirmation code or guest name.
 */
export const GET = handler(async (req: Request) => {
  const user = await requireUser();
  const q = str(new URL(req.url).searchParams.get("q"), 60);
  const recent = new Date(Date.now() - 2 * 86_400_000);
  const rows = await db.booking.findMany({
    where: {
      venueId: user.venue.id,
      ...(q
        ? { OR: [{ confirmation: { contains: q.toUpperCase() } }, { guestName: { contains: q, mode: "insensitive" as const } }] }
        : { OR: [{ checkedInAt: null, date: { gte: recent } }, { checkedInAt: { gte: recent } }] }),
    },
    orderBy: [{ checkedInAt: { sort: "desc", nulls: "first" } }, { date: "asc" }],
    take: 200,
    include: { channel: { select: { name: true } }, event: { select: { name: true } } },
  });
  return NextResponse.json({
    bookings: rows.map((r) => ({
      id: r.id, confirmation: r.confirmation, guestName: r.guestName, partySize: r.partySize, kind: r.kind,
      date: r.date.toISOString(), promoCode: r.promoCode, source: r.channel?.name ?? "Direct", event: r.event?.name ?? "",
      amountCents: r.amountCents, checkedInAt: r.checkedInAt?.toISOString() ?? null,
    })),
  });
});
