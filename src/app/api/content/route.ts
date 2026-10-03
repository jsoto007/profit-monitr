import { NextResponse } from "next/server";
import { FormError, handler, HttpError, readJson, str } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getRange } from "@/lib/dashboard";
import { assertNotDemo, rangeParam } from "@/lib/dashboard/request";
import { db, isUniqueViolation } from "@/lib/db";
import { linkHost, slugify } from "@/lib/util";

/** GET /api/content?range= — posts, emails and ads with the guests and revenue each one earned. */
export const GET = handler(async (req: Request) => {
  const user = await requireUser();
  const data = await getRange(user.venue, rangeParam(req));
  return NextResponse.json({ content: data.content });
});

/** POST /api/content — a tracked piece under a channel: monitr.link/<venue>/<channel>/<slug>. */
export const POST = handler(async (req: Request) => {
  const user = await requireUser();
  assertNotDemo(user);
  const b = await readJson<{ channelId?: string; name?: string; slug?: string }>(req);
  const name = str(b.name, 80);
  if (name.length < 2) throw new FormError({ name: "Name this post or campaign." });
  const channel = await db.channel.findFirst({ where: { id: str(b.channelId, 40), venueId: user.venue.id } });
  if (!channel) throw new HttpError(404, "Channel not found.");
  try {
    const c = await db.content.create({ data: { venueId: user.venue.id, channelId: channel.id, name, slug: slugify(str(b.slug, 40) || name, 32) } });
    return NextResponse.json({ ok: true, content: { id: c.id, slug: c.slug, link: `${linkHost()}/${user.venue.slug}/${channel.slug}/${c.slug}` } }, { status: 201 });
  } catch (err) {
    if (isUniqueViolation(err)) throw new FormError({ name: "That channel already has a piece with this name." });
    throw err;
  }
});
