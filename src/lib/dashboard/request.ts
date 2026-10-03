import { HttpError } from "@/lib/api";
import { isRangeKey, type RangeKey } from "@/lib/time";

/** ?range=week|last|month (default week). */
export function rangeParam(req: Request): RangeKey {
  const v = new URL(req.url).searchParams.get("range") ?? "week";
  if (!isRangeKey(v)) throw new HttpError(400, "range must be week, last or month.");
  return v;
}

/** The public demo venue cannot be edited through the API. */
export function assertNotDemo(user: { isDemo: boolean }) {
  if (user.isDemo) throw new HttpError(403, "The demo venue is read-only.");
}
