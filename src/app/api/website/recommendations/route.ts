import { NextResponse } from "next/server";
import { handler, HttpError, readJson, str } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getWebsite } from "@/lib/dashboard";
import { approveRecommendation } from "@/lib/dashboard/mutations";

/** GET /api/website/recommendations — site KPIs, agents and the changes waiting for approval. */
export const GET = handler(async () => {
  const user = await requireUser();
  return NextResponse.json(await getWebsite(user.venue, user.isDemo));
});

/** POST /api/website/recommendations { id } — approve a change. Idempotent. */
export const POST = handler(async (req: Request) => {
  const user = await requireUser();
  const id = str((await readJson<{ id?: string }>(req)).id, 40);
  if (!id) throw new HttpError(422, "Which recommendation?");
  return NextResponse.json(await approveRecommendation(user, id));
});
