"use client";

import { useEffect, useRef, useState } from "react";
import type { LiveData, LiveEvent } from "@/lib/dashboard/types";

export type LiveState = Pick<LiveData, "revCents" | "bookings" | "tickets" | "door" | "expected" | "feed"> & { now: string };

/** How one event moves tonight's counters. Pure — exported for tests. */
export function applyEvent(s: LiveState, e: LiveEvent): LiveState {
  if (s.feed.some((x) => x.id === e.id)) return s;
  const next = { ...s, now: e.at, feed: [e, ...s.feed].slice(0, 8) };
  if (e.k === "book") {
    next.bookings += 1;
    next.revCents += e.amountCents;
    if (e.tonight !== false) next.expected += e.n;
  } else if (e.k === "tix") {
    next.tickets += e.n;
    next.revCents += e.amountCents;
    // Real ticket orders say whether they are for tonight; the sample ticker's never count as expected.
    if (e.tonight === true) next.expected += e.n;
  } else if (e.k === "door") {
    next.door += e.n;
    next.revCents += e.amountCents;
  }
  return next;
}

const RETRY_MS = 5000;

/**
 * Tonight's counters and activity feed, kept current from /api/live/stream.
 * The stream is only held open while the tab is visible; `i` tells the
 * server which sample event comes next so a reconnect does not replay any.
 */
export function useLive(initial: LiveData, now: string, sample: boolean): LiveState {
  const [state, setState] = useState<LiveState>({ revCents: initial.revCents, bookings: initial.bookings, tickets: initial.tickets, door: initial.door, expected: initial.expected, feed: initial.feed, now });
  const sampleIndex = useRef(1);
  const connects = useRef(0);

  useEffect(() => {
    let es: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const clock = setInterval(() => setState((s) => ({ ...s, now: new Date().toISOString() })), 30_000);

    // The server's totals are the truth; the running sum only bridges the gaps between reads.
    // (The sample evening has no server-side totals to read.)
    const resync = () => {
      if (sample || document.hidden) return;
      fetch("/api/live")
        .then((r) => (r.ok ? r.json() : null))
        .then((d: LiveData | null) => {
          if (d) setState({ revCents: d.revCents, bookings: d.bookings, tickets: d.tickets, door: d.door, expected: d.expected, feed: d.feed, now: new Date().toISOString() });
        })
        .catch(() => {});
    };
    // A bill corrected at the door changes a total without a new event; pick it up within a minute.
    const refresh = setInterval(resync, 60_000);

    const close = () => {
      clearTimeout(retry);
      es?.close();
      es = null;
    };
    const open = () => {
      close();
      if (document.hidden) return;
      es = new EventSource(`/api/live/stream?i=${sampleIndex.current}`);
      // The stream only carries what happens while it is open, so after any gap (hidden tab,
      // dropped connection, the server recycling the stream) the totals are read again.
      if (connects.current++ > 0) resync();
      es.addEventListener("activity", (msg) => {
        const e = JSON.parse((msg as MessageEvent).data) as LiveEvent;
        if (e.id.startsWith("sim-")) sampleIndex.current += 1;
        setState((s) => applyEvent(s, e));
      });
      es.onerror = () => {
        // Reconnect ourselves so the request carries the current sample index.
        close();
        retry = setTimeout(open, RETRY_MS);
      };
    };

    open();
    document.addEventListener("visibilitychange", open);
    return () => {
      clearInterval(clock);
      clearInterval(refresh);
      document.removeEventListener("visibilitychange", open);
      close();
    };
  }, [sample]);

  return state;
}
