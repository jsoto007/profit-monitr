import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BookingForm, type TicketEvent } from "@/components/booking/BookingForm";
import "@/components/auth/auth.css";
import { db } from "@/lib/db";
import { zonedParts } from "@/lib/time";

export async function generateMetadata(props: PageProps<"/book/[venue]">): Promise<Metadata> {
  const { venue } = await props.params;
  const v = await db.venue.findUnique({ where: { slug: venue }, select: { name: true } });
  return { title: v ? `Book ${v.name}` : "Book", robots: { index: false, follow: false } };
}

/** Public booking page every tracked link lands on. */
export default async function BookPage(props: PageProps<"/book/[venue]">) {
  const { venue: slug } = await props.params;
  const sp = await props.searchParams;
  const venue = await db.venue.findUnique({ where: { slug } });
  if (!venue) notFound();

  const viaSlug = typeof sp.via === "string" ? sp.via : "";
  const contentSlug = typeof sp.c === "string" ? sp.c : "";
  const channel = viaSlug ? await db.channel.findFirst({ where: { venueId: venue.id, slug: viaSlug, active: true }, select: { slug: true, code: true, discountPct: true } }) : null;

  const now = new Date();
  const rows = await db.event.findMany({ where: { venueId: venue.id, kind: "TICKET", startsAt: { gt: now } }, orderBy: { startsAt: "asc" }, take: 6, include: { bookings: { select: { partySize: true } } } });
  const events: TicketEvent[] = rows.map((e) => ({
    id: e.id,
    name: e.name,
    when: e.startsAt.toLocaleDateString("en-US", { timeZone: venue.timezone, weekday: "short", month: "short", day: "numeric" }),
    priceCents: e.priceCents,
    left: e.capacity - e.bookings.reduce((s, b) => s + b.partySize, 0),
  }));

  // What this venue actually has on sale; tickets need at least one upcoming event.
  const kinds: ("RESERVATION" | "TICKET")[] = [];
  if (venue.sellsReservations || !venue.sellsTickets) kinds.push("RESERVATION");
  if (venue.sellsTickets && events.length) kinds.push("TICKET");
  if (sp.kind === "TICKET" && kinds.includes("TICKET")) kinds.reverse();

  const p = zonedParts(now, venue.timezone);
  const today = `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;

  return (
    <BookingForm
      venue={{ name: venue.name, slug: venue.slug, city: venue.city, type: venue.type, timezone: venue.timezone }}
      via={channel ? { slug: channel.slug, code: channel.code, discountPct: channel.discountPct, content: contentSlug } : null}
      kinds={kinds}
      events={events}
      today={today}
    />
  );
}
