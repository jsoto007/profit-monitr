import { NextResponse } from "next/server";
import { absoluteUrl, clientKey } from "@/lib/api";
import { db } from "@/lib/db";
import { firstInWindow } from "@/lib/rate-limit";

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|slack|discord|embedly|headless|curl|wget|python-requests|monitor/i;
/** One visitor counts once per link in this window, however often they tap it. */
const CLICK_WINDOW_MS = 30 * 60 * 1000;

async function resolve(req: Request, ctx: RouteContext<"/r/[venue]/[...path]">, count: boolean) {
  const { venue: venueSlug, path } = await ctx.params;
  const [channelSlug, contentSlug] = path;
  const channel = await db.channel.findFirst({
    where: { slug: channelSlug, venue: { slug: venueSlug } },
    include: { venue: { select: { slug: true } }, contents: contentSlug ? { where: { slug: contentSlug }, select: { id: true, slug: true } } : false },
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
  const to = absoluteUrl(req, `/book/${channel.venue.slug}`);
  to.searchParams.set("via", channel.slug);
  if (content) to.searchParams.set("c", content.slug);
  return NextResponse.redirect(to, 302);
}

/**
 * Tracked-link redirect: monitr.link/<venue>/<channel>[/<content>] logs the
 * click and sends the guest to the venue's booking page with the source
 * attached, so the booking — and later the check-in — is credited to it.
 */
export const GET = (req: Request, ctx: RouteContext<"/r/[venue]/[...path]">) => resolve(req, ctx, true);
/** HEAD is what link checkers send; it redirects without counting. */
export const HEAD = (req: Request, ctx: RouteContext<"/r/[venue]/[...path]">) => resolve(req, ctx, false);
