import type { Metrics, Reservations as Data } from "@/lib/dashboard/types";
import { fmt, pct } from "@/lib/util";
import { Bars, delta, Kpi } from "../parts";

export function Reservations({ m, r }: { m: Metrics; r: Data }) {
  const res = delta(m.deltas.res);
  const tix = delta(m.deltas.tix);
  const door = delta(m.deltas.door);
  const max = Math.max(0, ...r.sources.map((s) => s.booked));
  return (
    <div className="db-screen">
      <section>
        <div className="kicker">WHAT&apos;S GENERATING RESERVATIONS · {m.rangeLabel}</div>
        <h1 className="db-h1">
          {fmt(m.res)} tables and {fmt(m.tix)} tickets.{m.showRate === "—" ? "" : ` ${m.showRate} of them walked through the door.`}
        </h1>
        <div className="db-kpis">
          <Kpi label="Reservations" value={fmt(m.res)} note={res.note} up={res.up} />
          <Kpi label="Tickets sold" value={fmt(m.tix)} note={tix.note} up={tix.up} />
          <Kpi mint label="Guests at the door" value={fmt(m.door)} note={door.note} />
          <Kpi label="No-shows" value={m.noShowRate} note={m.noShowNote} />
        </div>
      </section>

      <section className="db-two w380">
        <div className="pod lavender res-chart">
          <div className="db-head flush">
            <h2 className="db-h2">Bookings by day</h2>
            <span className="db-aside">{r.quietNote}</span>
          </div>
          <Bars bars={r.bars} label="Bookings by day" strong format={fmt} />
        </div>
        <div className="pod line">
          <h2 className="db-h2">Where bookings came from</h2>
          <div className="src-rows">
            {r.sources.map((s) => (
              <div key={s.id} className="src-row">
                <span>{s.name}</span>
                <div className="track"><div style={{ width: pct(max ? s.booked / max : 0) }} /></div>
                <span><b>{fmt(s.booked)}</b> <span>· {fmt(s.door)} in</span></span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="coming-up">
        <h2 id="coming-up" className="db-h2" style={{ marginBottom: 14 }}>Coming up</h2>
        {r.upcoming.length ? (
          <div className="upcoming">
            {r.upcoming.map((u) => (
              <div key={u.id} className="up-card">
                <div className="up-when">{u.when}</div>
                <div className="up-headline">{u.headline}</div>
                <div className="track" role="img" aria-label={`${u.pct}%`}><div style={{ width: `${u.pct}%` }} /></div>
                <div className="up-note">{u.note}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="table"><div className="db-empty">No upcoming events yet. Ticketed nights and bookable services appear here with how full they are.</div></div>
        )}
      </section>
    </div>
  );
}
