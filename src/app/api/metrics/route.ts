import { NextResponse } from "next/server";
import { handler } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getRange } from "@/lib/dashboard";
import { rangeParam } from "@/lib/dashboard/request";

/** GET /api/metrics?range=week|last|month */
export const GET = handler(async (req: Request) => {
  const user = await requireUser();
  const data = await getRange(user.venue, rangeParam(req));
  return NextResponse.json(data.metrics);
});
