import { NextResponse } from "next/server";
import { ensureDemoAccount } from "@/lib/accounts";
import { absoluteUrl, clientKey, handler } from "@/lib/api";
import { createSession, getCurrentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

/**
 * "Explore the demo": signs the visitor into the shared demo venue (The Copper
 * Room) and sends them to the dashboard. Someone already signed in keeps
 * their own session. Posted from a plain <form>, so it answers with a redirect.
 */
export const POST = handler(async (req: Request) => {
  rateLimit(`demo:${clientKey(req)}`, 20, 60_000);
  if (!(await getCurrentUser())) {
    const user = await ensureDemoAccount();
    // Demo sessions are throwaway: one day, not thirty.
    await createSession(user.id, 1);
  }
  return NextResponse.redirect(absoluteUrl(req, "/app"), 303);
});
