import { NextResponse } from "next/server";
import { handler } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getLive } from "@/lib/dashboard";

/** GET /api/live — tonight so far. New activity arrives on /api/live/stream. */
export const GET = handler(async () => {
  const user = await requireUser();
  return NextResponse.json(await getLive(user.venue));
});
