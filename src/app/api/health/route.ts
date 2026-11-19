import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { launchGaps } from "@/lib/launch";

/**
 * Render health check: the process is up and Postgres answers. `launch` lists
 * the public facts (founder, contact, scheduling link) still unset in
 * src/data/site.ts — empty once the site is ready for outreach.
 */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, launch: launchGaps() });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
