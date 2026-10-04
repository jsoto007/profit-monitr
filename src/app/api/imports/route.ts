import { NextResponse } from "next/server";
import { handler, HttpError, readJson, str } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { assertNotDemo } from "@/lib/dashboard/request";
import { importOrders, isImportProvider, recentImports } from "@/lib/imports";
import { rateLimit } from "@/lib/rate-limit";

type Body = { provider?: string; fileName?: string; csv?: string; dryRun?: boolean };

/**
 * POST /api/imports { provider, fileName, csv, dryRun } — a platform's orders
 * export. dryRun:true reads the file and reports what would happen; false
 * writes it. Either way the response is the same summary.
 */
export const POST = handler(async (req: Request) => {
  const user = await requireUser();
  assertNotDemo(user);
  rateLimit(`import:${user.id}`, 20, 60_000);
  const b = await readJson<Body>(req);
  if (!isImportProvider(b.provider)) throw new HttpError(422, "provider must be eventbrite, posh or opentable.");
  if (typeof b.csv !== "string" || !b.csv.trim()) throw new HttpError(422, "Choose a CSV file first.");
  return NextResponse.json(await importOrders(user, b.provider, b.csv, str(b.fileName, 120), b.dryRun !== false));
});

/** GET /api/imports — the owner's recent uploads. */
export const GET = handler(async () => {
  const user = await requireUser();
  return NextResponse.json({ imports: user.isDemo ? [] : await recentImports(user.venue.id) });
});
