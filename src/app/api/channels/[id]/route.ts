import { NextResponse } from "next/server";
import { FormError, handler, readJson, str } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { setChannelDestination } from "@/lib/dashboard/mutations";
import { assertNotDemo } from "@/lib/dashboard/request";
import { normalizeDestination, ownHosts } from "@/lib/destinations";

/**
 * PATCH /api/channels/:id { destination } — where this one link sends people:
 * the platform's own tracking link for the promoter or campaign. Empty = the
 * venue's booking page. Validated against the allow-list before it is saved.
 */
export const PATCH = handler(async (req: Request, ctx: RouteContext<"/api/channels/[id]">) => {
  const user = await requireUser();
  assertNotDemo(user);
  const { id } = await ctx.params;
  const b = await readJson<{ destination?: string }>(req);
  const n = normalizeDestination(str(b.destination, 600), user.venue.website, ownHosts(req));
  if ("error" in n) throw new FormError({ destination: n.error });
  const r = await setChannelDestination(user, str(id, 40), n.url);
  return NextResponse.json({ ...r, destination: n.url, provider: n.provider });
});
