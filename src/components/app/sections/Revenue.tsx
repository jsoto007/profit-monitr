import type { ChannelRow, ContentRow, Metrics } from "@/lib/dashboard/types";
import { fmt, money, pct } from "@/lib/util";
import { delta, Kpi, VerdictPill } from "../parts";

export function Revenue({ m, channels, content }: { m: Metrics; channels: ChannelRow[]; content: ContentRow[] }) {
  const rev = delta(m.deltas.rev);
  const rows = [...channels].sort((a, b) => b.revCents - a.revCents);
  const max = Math.max(0, ...rows.map((c) => c.revCents));
  return (
    <div className="db-screen">
      <section>
        <div className="kicker">WHAT GENERATED REVENUE · {m.rangeLabel}</div>
        <h1 className="db-h1">{m.revenueHeadline}</h1>
        <div className="db-kpis">
          <Kpi mint label="Revenue from marketing" value={money(m.revCents)} note={rev.note} />
          <Kpi label="Share of all sales" value={m.shareOfSales} note="traced to a link or code" />
          <Kpi label="Revenue per guest" value={m.revPerGuest} note={m.revPerGuestNote} />
          <Kpi label="Marketing spend" value={money(m.spendCents)} note={`${m.roi} return`} />
        </div>
        {/* Two recognition bases never share one number unexplained: what the platform took at purchase, and what the door took. */}
        {(m.platformCents > 0 || m.unattributedCents > 0) && (
          <p className="rev-split">
            {m.platformCents > 0 && <>Of this, <b>{money(m.platformCents)}</b> was ticket sales your platform took at purchase and <b>{money(m.doorCents)}</b> was taken at the door. </>}
            {m.unattributedCents > 0 && <>Another <b>{money(m.unattributedCents)}</b> of platform orders carried no code or link, so no source gets the credit.</>}
          </p>
        )}
      </section>

      <section className="pod alt rev-pod" aria-labelledby="by-channel">
        <div className="db-head wrap flush">
          <h2 id="by-channel" className="db-h2">Revenue by channel</h2>
          <span className="db-aside">Revenue · return on spend</span>
        </div>
        <div className="rev-rows">
          {rows.map((c) => (
            <div key={c.id} className={`rev-row${c.weak ? " is-weak" : ""}`}>
              <span>{c.name}</span>
              <div className="track"><div style={{ width: pct(max ? c.revCents / max : 0) }} /></div>
              {c.fidelity === "clicks" ? <span><b>—</b> <span>· clicks only</span></span> : <span><b>{money(c.revCents)}</b> <span>· {c.roi}</span></span>}
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="content">
        <h2 id="content" className="db-h2" style={{ marginBottom: 14 }}>Content that made money</h2>
        <div className="table">
          {content.length ? (
            content.map((r) => (
              <div key={r.id} className="table-row">
                <div className="table-name">
                  <div>{r.name}</div>
                  <div>{r.channel}</div>
                </div>
                <div><div className="cell-label">Guests</div><div className="cell-value">{fmt(r.door)}</div></div>
                <div><div className="cell-label">Revenue</div><div className="cell-value">{money(r.revCents)}</div></div>
                <div><div className="cell-label">Per guest</div><div className="cell-value">{money(r.perGuestCents)}</div></div>
                <VerdictPill verdict={r.verdict} />
              </div>
            ))
          ) : (
            <div className="db-empty">No posts, emails or ads are being tracked yet. Each one gets its own link under a channel, and shows here with the guests and revenue it earned.</div>
          )}
        </div>
      </section>
    </div>
  );
}
