import { NextResponse } from "next/server";
import { absoluteUrl, clientKey } from "@/lib/api";
import { db } from "@/lib/db";
import { withTracking } from "@/lib/destinations";
import { firstInWindow } from "@/lib/rate-limit";

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|slack|discord|embedly|headless|curl|wget|python-requests|monitor/i;
/** One visitor counts once per link in this window, however often they tap it. */
const CLICK_WINDOW_MS = 30 * 60 * 1000;

type Target = { channel: { slug: string; destination: string }; venue: { slug: string; bookingUrl: string }; content?: { slug: string } };

/**
 * Where this link sends people: the channel's own destination (the platform's
 * tracking link for this promoter or campaign), else the venue's booking page,
 * else Monitr's own booking page with the source attached. External URLs were
 * validated against the allow-list when they were saved (src/lib/destinations.ts).
 */
export function destinationFor(req: Request, t: Target): URL {
  const external = t.channel.destination || t.venue.bookingUrl;
  if (external) return new URL(withTracking(external, t.channel.slug));
  const to = absoluteUrl(req, `/book/${t.venue.slug}`);
  to.searchParams.set("via", t.channel.slug);
  if (t.content) to.searchParams.set("c", t.content.slug);
  return to;
}

async function resolve(req: Request, ctx: RouteContext<"/r/[venue]/[...path]">, count: boolean) {
  const { venue: venueSlug, path } = await ctx.params;
  const [channelSlug, contentSlug] = path;
  const channel = await db.channel.findFirst({
    where: { slug: channelSlug, venue: { slug: venueSlug } },
    include: { venue: { select: { slug: true, bookingUrl: true } }, contents: contentSlug ? { where: { slug: contentSlug }, select: { id: true, slug: true } } : false },
  });
  if (!channel) return NextResponse.redirect(absoluteUrl(req, "/"), 302);
  const content = contentSlug ? channel.contents?.[0] : undefined;
  const agent = req.headers.get("user-agent") || "";
  // Clicks drive the "Working / Not working" verdicts, so link unfurlers, crawlers and repeat taps are not counted.
  if (count && channel.active && !BOT.test(agent) && firstInWindow(`click:${channel.id}:${clientKey(req)}`, CLICK_WINDOW_MS)) {
    await db.clickEvent.create({
      data: { channelId: channel.id, contentId: content?.id ?? null, userAgent: agent.slice(0, 300), referer: (req.headers.get("referer") || "").slice(0, 300) },
    });
  }
  return NextResponse.redirect(destinationFor(req, { channel, venue: channel.venue, content }), 302);
}

/**
 * Tracked-link redirect: monitr.link/<venue>/<channel>[/<content>] logs the
 * click and sends the guest on to where the venue takes bookings, so the
 * booking — on Monitr's page, or later through an imported order — is
 * credited to it.
 */
export const GET = (req: Request, ctx: RouteContext<"/r/[venue]/[...path]">) => resolve(req, ctx, true);
/** HEAD is what link checkers send; it redirects to the same place without counting. */
export const HEAD = (req: Request, ctx: RouteContext<"/r/[venue]/[...path]">) => resolve(req, ctx, false);
