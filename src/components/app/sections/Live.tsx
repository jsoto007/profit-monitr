import Link from "next/link";
import type { LiveData } from "@/lib/dashboard/types";
import { fmt, money } from "@/lib/util";
import { Bars, Kpi } from "../parts";
import type { LiveState } from "../useLive";

type Props = { live: LiveState; base: LiveData; tz: string; noteSent: boolean; onSend: () => void };

export function Live({ live, base, tz, noteSent, onSend }: Props) {
  const clock = new Date(live.now).toLocaleTimeString("en-US", { timeZone: tz, hour: "2-digit", minute: "2-digit" });
  const time = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return (
    <div className="db-screen gap-32">
      <section>
        <div className="kicker db-kicker-row"><span className="dot" />WHAT&apos;S HAPPENING RIGHT NOW · {clock}</div>
        <h1 className="db-h1">{fmt(live.door)} guests in tonight. {fmt(Math.max(0, live.expected - live.door))} more on the way.</h1>
        <div className="db-kpis">
          <Kpi mint label="Revenue tonight" value={money(live.revCents)} note={base.traced === "—" ? "nothing traced yet" : `${base.traced} traced to marketing`} />
          <Kpi label="Bookings today" value={fmt(live.bookings)} note={`${fmt(live.tickets)} tickets sold`} />
          <Kpi label="Checked in" value={fmt(live.door)} note={`of ${fmt(live.expected)} expected`} />
          <Kpi text label="Top source tonight" value={base.top.name} note={base.top.note} />
        </div>
      </section>

      <section className="db-two w380">
        <div className="pod line">
          <div className="db-head flush">
            <h2 className="db-h2">Activity</h2>
            <Link href="/app/door" className="door-link">Door check-in →</Link>
          </div>
          <div className="feed" aria-live="off">
            {live.feed.length ? (
              live.feed.map((e) => (
                <div key={e.id} className="feed-row">
                  <span className="feed-time">{time(e.at)}</span>
                  <span className={`feed-dot${e.k === "door" ? " door" : e.k === "agent" ? " agent" : ""}`} />
                  <span className="feed-text"><b>{e.txt}</b><span>{e.src}</span></span>
                  <span className="feed-amt">{e.amountCents ? money(e.amountCents) : ""}</span>
                </div>
              ))
            ) : (
              <div className="db-empty" style={{ paddingInline: 0 }}>Nothing yet tonight. Bookings, ticket sales and check-ins appear here as they happen.</div>
            )}
          </div>
        </div>
        <div className="live-side">
          <div className="pod lavender live-hours">
            <h2 className="db-h2">Tonight&apos;s arrivals</h2>
            <Bars bars={base.hours} label="Arrivals by hour" strong format={fmt} />
          </div>
          {base.note && (
            <div className="pod dark on-dark">
              <div className="note-kicker">AGENT NOTE · JUST NOW</div>
              <div className="note-body">{base.note.body}</div>
              <button type="button" className="btn btn-sm btn-light note-btn" onClick={onSend} aria-disabled={noteSent}>{noteSent ? "Sent · tracking" : "Send the email"}</button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
