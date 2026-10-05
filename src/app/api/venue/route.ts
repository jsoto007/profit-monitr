import { NextResponse } from "next/server";
import { handler, HttpError, readJson, str } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { chooseBookingPage, setSampleData } from "@/lib/dashboard/mutations";
import { assertNotDemo } from "@/lib/dashboard/request";
import { ownHosts } from "@/lib/destinations";

type Body = { sampleData?: boolean; bookingProvider?: string; bookingUrl?: string };

/**
 * PATCH /api/venue
 *   { sampleData }                 — switch between the sample venue and the venue's own data
 *   { bookingProvider, bookingUrl } — where the venue's links send people by default
 */
export const PATCH = handler(async (req: Request) => {
  const user = await requireUser();
  const b = await readJson<Body>(req);

  if ("sampleData" in b) {
    if (typeof b.sampleData !== "boolean") throw new HttpError(422, "sampleData must be true or false.");
    return NextResponse.json(await setSampleData(user, b.sampleData));
  }

  if ("bookingUrl" in b || "bookingProvider" in b) {
    assertNotDemo(user);
    return NextResponse.json(await chooseBookingPage(user, b.bookingProvider, str(b.bookingUrl, 600), ownHosts(req)));
  }

  throw new HttpError(422, "Nothing to change.");
});
