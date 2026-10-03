import { LIVE_TICK_MS } from "@/data/sample";
import { getCurrentUser } from "@/lib/auth";
import { realEventsSince } from "@/lib/dashboard/real";
import { sampleEvent } from "@/lib/dashboard/sample";
import { acquire, release } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Streams end themselves after this long; the client reconnects and re-reads /api/live. */
const MAX_STREAM_MS = 15 * 60 * 1000;
/** Only streams that poll the database are capped; the sample evening costs a timer and nothing else. */
const MAX_STREAMS_PER_USER = 5;

/**
 * GET /api/live/stream — Server-Sent Events for the Live feed.
 *
 *   event: activity   data: LiveEvent   (a booking, ticket order, check-in or agent action)
 *   event: ping                         (keeps proxies from closing a quiet stream)
 *
 * A venue on its own data gets its bookings and check-ins as they happen. A
 * venue on sample data (and the demo) gets only the sample evening, one event
 * per tick, with no database polling; `i` is the index of the next sample
 * event so a reconnect carries on where it left off.
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Not signed in", { status: 401 });
  const venue = user.venue;
  const slot = venue.sampleData ? null : `stream:${user.id}`;
  if (slot && !acquire(slot, MAX_STREAMS_PER_USER)) return new Response("Too many open streams", { status: 429 });

  let i = Math.max(0, Math.floor(Number(new URL(req.url).searchParams.get("i")) || 0));
  let since = new Date();
  const started = Date.now();
  const enc = new TextEncoder();
  let open = true;
  let timer: ReturnType<typeof setInterval> | undefined;
  const stop = () => {
    if (!open) return false;
    open = false;
    clearInterval(timer);
    if (slot) release(slot);
    return true;
  };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const close = () => {
        if (!stop()) return;
        try {
          controller.close();
        } catch {
          /* already closed by the client */
        }
      };
      const send = (event: string, data: unknown) => {
        if (open) controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      const tick = async () => {
        if (Date.now() - started > MAX_STREAM_MS) return close();
        try {
          if (venue.sampleData) return send("activity", sampleEvent(i++, new Date()));
          const real = await realEventsSince(venue, since);
          if (!real.length) return send("ping", {});
          since = new Date(real[real.length - 1].at);
          for (const e of real) send("activity", e);
        } catch (err) {
          console.error("[live] tick failed", err);
        }
      };
      send("ping", {});
      timer = setInterval(tick, LIVE_TICK_MS);
      req.signal.addEventListener("abort", close);
    },
    cancel() {
      stop();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
