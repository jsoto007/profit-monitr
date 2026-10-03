import { Rich } from "@/components/ui/Rich";
import type { ActionItem, Metrics } from "@/lib/dashboard/types";
import { fmt, money } from "@/lib/util";
import { Bars, delta, Kpi } from "../parts";
import type { Tab } from "../tabs";

type Props = { m: Metrics; next: ActionItem | null; openCount: number; nextBrief: string; go: (t: Tab) => void; approve: (id: string) => void };

export function Overview({ m, next, openCount, nextBrief, go, approve }: Props) {
  const res = delta(m.deltas.res);
  const tix = delta(m.deltas.tix);
  return (
    <div className="db-screen">
      <section className="ov-hero">
        <div>
          <div className="kicker">WHAT HAPPENED · {m.rangeLabel}</div>
          <h1 className="ov-h1">Your marketing made <span className="ov-figure">{money(m.revCents)}</span> in sales.</h1>
          <p className="ov-summary">{m.summary}</p>
          <div className="ov-cta">
            <button type="button" className="btn btn-md" onClick={() => go("actions")}>See what to do next</button>
            <button type="button" className="btn btn-md btn-secondary" onClick={() => go("revenue")}>Where it came from</button>
          </div>
        </div>
        <div className="pod mint ov-chart">
          <div className="ov-chart-head">
            <b>{m.chart.title}</b>
            <span>{m.chart.note}</span>
          </div>
          <Bars bars={m.chart.bars} label={m.chart.title} format={money} />
        </div>
      </section>

      <section aria-labelledby="glance">
        <div className="db-head">
          <h2 id="glance" className="db-h2">At a glance</h2>
          <span className="db-aside">Tap a card to go deeper</span>
        </div>
        <div className="db-kpis wide">
          <Kpi label="Reservations" value={fmt(m.res)} note={res.note} up={res.up} onClick={() => go("reservations")} />
          <Kpi label="Tickets sold" value={fmt(m.tix)} note={tix.note} up={tix.up} onClick={() => go("reservations")} />
          <Kpi label="Guests at the door" value={fmt(m.door)} note={m.showRate === "—" ? "checked in at the door" : `${m.showRate} of bookings showed up`} onClick={() => go("reservations")} />
          <Kpi label="Return on marketing" value={m.roi} note={`on ${money(m.spendCents)} spent`} onClick={() => go("revenue")} />
        </div>
      </section>

      <section className="db-two">
        <div className="pod lavender">
          <h2 className="db-h2">Why it happened</h2>
          <ol className="why">
            {m.why.map((w, i) => (
              <li key={i}>
                <span className="why-n">{i + 1}</span>
                <span><Rich text={w} /></span>
              </li>
            ))}
          </ol>
        </div>
        <div className="pod dark on-dark">
          <div className="db-head flush">
            <h2 className="db-h2">Your next best action</h2>
            <button type="button" className="nba-all" onClick={() => go("actions")}>All {openCount} →</button>
          </div>
          {next ? (
            <>
              <div className="nba-title">{next.title}</div>
              <div className="nba-desc">{next.description}</div>
              <div className="nba-foot">
                <button type="button" className="btn btn-sm btn-light" onClick={() => approve(next.id)}>Approve</button>
                <span>{next.estimate}</span>
              </div>
            </>
          ) : (
            <div className="nba-none">All caught up. Your next report lands {nextBrief}.</div>
          )}
        </div>
      </section>
    </div>
  );
}
