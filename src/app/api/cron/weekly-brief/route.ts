import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { siteUrl } from "@/data/site";
import { handler, HttpError } from "@/lib/api";
import { generateWeeklyBrief } from "@/lib/brief";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { zonedParts } from "@/lib/time";
import { money } from "@/lib/util";

/** A venue's brief is built once its own Monday has reached this hour. */
const BRIEF_HOUR = 6;

function authorised(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new HttpError(503, "Not available.");
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * POST /api/cron/weekly-brief — call it hourly on Mondays (UTC). Each venue is
 * handled when it is Monday morning in its own time zone, so "last week" is
 * the venue's last week wherever it is. Repeat calls are harmless: a venue
 * whose brief exists is skipped, and one venue failing never stops the rest.
 */
export const POST = handler(async (req: Request) => {
  if (!authorised(req)) throw new HttpError(401, "Bad cron secret.");
  const now = new Date();
  const venues = await db.venue.findMany({ where: { user: { isDemo: false } }, include: { user: true } });
  let generated = 0;
  let failed = 0;
  for (const v of venues) {
    const local = zonedParts(now, v.timezone);
    if (local.dow !== 0 || local.h < BRIEF_HOUR) continue;
    try {
      const brief = await generateWeeklyBrief(v, now);
      if (!brief || !brief.created) continue;
      generated++;
      await sendEmail({
        to: v.user.email,
        subject: `${v.name}: your marketing made ${money(brief.revCents)} last week`,
        text: `${brief.door} guests came through your links and codes last week.\n\nDo this week:\n${brief.actions.map((a, i) => `${i + 1}. ${a.title}`).join("\n")}\n\nRead the brief: ${siteUrl()}/app?tab=actions`,
      });
    } catch (err) {
      failed++;
      console.error("[brief] failed for venue", v.id, err);
    }
  }
  return NextResponse.json({ ok: true, venues: venues.length, generated, failed });
});
