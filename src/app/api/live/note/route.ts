import { NextResponse } from "next/server";
import { handler, HttpError, readJson, str } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { approveAgentNote } from "@/lib/dashboard/mutations";

/** POST /api/live/note { id } — go ahead with the agent's suggestion. Idempotent. */
export const POST = handler(async (req: Request) => {
  const user = await requireUser();
  const id = str((await readJson<{ id?: string }>(req)).id, 40);
  if (!id) throw new HttpError(422, "Which note?");
  return NextResponse.json(await approveAgentNote(user, id));
});
