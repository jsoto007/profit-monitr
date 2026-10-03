import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/** Render health check: the process is up and Postgres answers. */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
