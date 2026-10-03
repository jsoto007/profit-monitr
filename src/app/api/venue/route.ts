import { NextResponse } from "next/server";
import { handler, HttpError, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { setSampleData } from "@/lib/dashboard/mutations";

/** PATCH /api/venue { sampleData } — switch between the sample venue and the venue's own data. */
export const PATCH = handler(async (req: Request) => {
  const user = await requireUser();
  const b = await readJson<{ sampleData?: boolean }>(req);
  if (typeof b.sampleData !== "boolean") throw new HttpError(422, "sampleData must be true or false.");
  return NextResponse.json(await setSampleData(user, b.sampleData));
});
