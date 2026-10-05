import { handler } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { csvLine } from "@/lib/csv";
import { assertNotDemo } from "@/lib/dashboard/request";
import { db } from "@/lib/db";
import { moneyExact } from "@/lib/util";

const HEADERS = ["Confirmation", "Guest", "Email", "Party", "Kind", "Date (UTC)", "Event", "Source", "Promo code", "Provider", "Platform order id", "Amount", "Paid at (UTC)", "Checked in at (UTC)", "Booked at (UTC)"];
/** Newest first; a venue past this many bookings gets the newest and a final line saying so. */
const MAX_ROWS = 50_000;

/**
 * GET /api/export — every booking the venue has, as a CSV download: what the
 * pilot terms promise ("export it any time"). Money is exact dollars and cents;
 * text cells that look like formulas are neutralised (src/lib/csv.ts).
 */
export const GET = handler(async () => {
  const user = await requireUser();
  assertNotDemo(user);
  const rows = await db.booking.findMany({
    where: { venueId: user.venue.id },
    orderBy: { date: "desc" },
    take: MAX_ROWS + 1,
    include: { channel: { select: { name: true } }, event: { select: { name: true } } },
  });
  const iso = (d: Date | null) => (d ? d.toISOString() : "");
  const lines = [csvLine(HEADERS)];
  for (const r of rows.slice(0, MAX_ROWS)) {
    lines.push(csvLine([r.confirmation, r.guestName, r.guestEmail, r.partySize, r.kind, iso(r.date), r.event?.name ?? "", r.channel?.name ?? "", r.promoCode, r.provider, r.externalId ?? "", moneyExact(r.amountCents), iso(r.paidAt), iso(r.checkedInAt), iso(r.createdAt)]));
  }
  if (rows.length > MAX_ROWS) lines.push(csvLine([`Only the newest ${MAX_ROWS.toLocaleString("en-US")} bookings are in this file — ask us for the rest.`]));
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(lines.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${user.venue.slug}-bookings-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});
