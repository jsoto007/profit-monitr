import { NextResponse } from "next/server";
import { FormError, handler, HttpError, readJson, str } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { setBookingPage, setSampleData } from "@/lib/dashboard/mutations";
import { assertNotDemo } from "@/lib/dashboard/request";
import { isProvider, normalizeDestination, ownHosts, type Provider } from "@/lib/destinations";

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
    const chosen: Provider = isProvider(b.bookingProvider) ? b.bookingProvider : "native";
    const raw = str(b.bookingUrl, 600);
    if (chosen !== "native" && !raw) throw new FormError({ bookingUrl: "Paste the page where guests book." });
    // The pasted page decides the provider; an empty page means Monitr's own booking page.
    const n = chosen === "native" ? { url: "", provider: "native" as Provider } : normalizeDestination(raw, user.venue.website, ownHosts(req));
    if ("error" in n) throw new FormError({ bookingUrl: n.error });
    const r = await setBookingPage(user, n.provider, n.url);
    return NextResponse.json({ ...r, bookingProvider: n.provider, bookingUrl: n.url });
  }

  throw new HttpError(422, "Nothing to change.");
});
