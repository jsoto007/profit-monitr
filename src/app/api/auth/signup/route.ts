import { NextResponse } from "next/server";
import { clientKey, handler, readJson } from "@/lib/api";
import { createSession } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { signup, type SignupBody } from "@/lib/signup";
import { nextBriefLabel } from "@/lib/time";
import { firstName, linkHost } from "@/lib/util";

export const POST = handler(async (req: Request) => {
  rateLimit(`signup:${clientKey(req)}`, 10, 60_000);
  const user = await signup(await readJson<SignupBody>(req));
  await createSession(user.id);
  const venue = user.venue!;
  return NextResponse.json({
    ok: true,
    firstName: firstName(user.name),
    venueName: venue.name,
    firstLink: `${linkHost()}/${venue.slug}/ig`,
    firstBrief: nextBriefLabel(new Date(), venue.timezone),
  });
});
