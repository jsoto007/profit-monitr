import { NextResponse } from "next/server";
import { FormError, handler, readJson, str } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getRange } from "@/lib/dashboard";
import { assertNotDemo, rangeParam } from "@/lib/dashboard/request";
import { db, isUniqueViolation } from "@/lib/db";
import { cleanCode, linkHost, parseDollars, slugify } from "@/lib/util";

/** GET /api/channels?range= — every tracked source with its clicks, guests and revenue. */
export const GET = handler(async (req: Request) => {
  const user = await requireUser();
  const data = await getRange(user.venue, rangeParam(req));
  return NextResponse.json({ channels: data.channels, sortNotes: data.sortNotes });
});

type Body = { name?: string; detail?: string; slug?: string; code?: string; discountPct?: number; weeklySpend?: string | number };

/** POST /api/channels — a new tracked link + promo code (for an influencer, promoter or campaign). */
export const POST = handler(async (req: Request) => {
  const user = await requireUser();
  assertNotDemo(user);
  const b = await readJson<Body>(req);
  const name = str(b.name, 80);
  const code = cleanCode(str(b.code, 12));
  const slug = slugify(str(b.slug, 40) || name, 32);
  const spend = b.weeklySpend === undefined || b.weeklySpend === "" ? 0 : parseDollars(b.weeklySpend);
  const discount = b.discountPct == null ? null : Math.round(Number(b.discountPct));
  const e: Record<string, string> = {};
  if (name.length < 2) e.name = "Name this source.";
  if (code.length < 3) e.code = "At least 3 characters.";
  if (spend === null) e.weeklySpend = "Enter dollars and cents, e.g. 250.00.";
  if (discount !== null && !(discount >= 1 && discount <= 100)) e.discountPct = "Between 1 and 100.";
  if (Object.keys(e).length) throw new FormError(e);
  try {
    const c = await db.channel.create({
      data: { venueId: user.venue.id, name, short: name, detail: str(b.detail, 80), slug, code, discountPct: discount, weeklySpendCents: spend ?? 0 },
    });
    return NextResponse.json({ ok: true, channel: { id: c.id, slug: c.slug, code: c.code, link: `${linkHost()}/${user.venue.slug}/${c.slug}` } }, { status: 201 });
  } catch (err) {
    // The unique indexes on (venue, slug) and (venue, code) decide — no check-then-insert.
    if (isUniqueViolation(err)) throw new FormError({ code: "That link or code is already in use." });
    throw err;
  }
});
