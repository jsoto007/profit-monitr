import { NextResponse } from "next/server";
import { absoluteUrl, handler } from "@/lib/api";
import { destroySession } from "@/lib/auth";

export const POST = handler(async (req: Request) => {
  await destroySession();
  // A plain <form> post lands back on the landing page; fetch() callers get JSON.
  if ((req.headers.get("accept") || "").includes("text/html")) return NextResponse.redirect(absoluteUrl(req, "/"), 303);
  return NextResponse.json({ ok: true });
});
