import { NextResponse } from "next/server";
import { handler } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { requestExpert } from "@/lib/dashboard/mutations";

/** POST /api/expert — ask for the included 30-minute strategist session. */
export const POST = handler(async () => {
  const user = await requireUser();
  return NextResponse.json(await requestExpert(user));
});
