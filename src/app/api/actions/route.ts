import { NextResponse } from "next/server";
import { handler, HttpError, readJson, str } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getActions } from "@/lib/dashboard";
import { approveAction } from "@/lib/dashboard/mutations";

/** GET /api/actions — this week's three moves and last week's results. */
export const GET = handler(async () => {
  const user = await requireUser();
  return NextResponse.json(await getActions(user.venue));
});

/** POST /api/actions { id } — approve a move. Idempotent. */
export const POST = handler(async (req: Request) => {
  const user = await requireUser();
  const id = str((await readJson<{ id?: string }>(req)).id, 40);
  if (!id) throw new HttpError(422, "Which action?");
  return NextResponse.json(await approveAction(user, id));
});
