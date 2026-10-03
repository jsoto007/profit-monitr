import type { ChannelRow, SortKey } from "@/lib/dashboard/types";
import { fmt, money, pct } from "@/lib/util";
import { VerdictPill } from "../parts";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "clicks", label: "Clicks" },
  { key: "door", label: "Guests at the door" },
  { key: "rev", label: "Revenue" },
  { key: "rate", label: "Conversion" },
];
const VALUE: Record<SortKey, (c: ChannelRow) => number> = { clicks: (c) => c.clicks, door: (c) => c.door, rev: (c) => c.revCents, rate: (c) => c.rate };

type Props = { rangeLabel: string; channels: ChannelRow[]; notes: Record<SortKey, string>; sort: SortKey; onSort: (s: SortKey) => void };

export function Channels({ rangeLabel, channels, notes, sort, onSort }: Props) {
  const max = { clicks: Math.max(0, ...channels.map((c) => c.clicks)), door: Math.max(0, ...channels.map((c) => c.door)), rev: Math.max(0, ...channels.map((c) => c.revCents)) };
  // Array.prototype.sort is stable, so ties keep the server's order.
  const rows = [...channels].sort((a, b) => VALUE[sort](b) - VALUE[sort](a));
  const w = (v: number, m: number) => pct(m ? v / m : 0);
  return (
    <div className="db-screen gap-28">
      <section>
        <div className="kicker">WHICH CAMPAIGNS AND CONTENT ARE CONVERTING · {rangeLabel}</div>
        <h1 className="db-h1">Clicks are noise. Guests at the door are the signal.</h1>
        <div className="ch-controls">
          <span id="rank-by">Rank by</span>
          <div className="seg" role="group" aria-labelledby="rank-by">
            {SORTS.map((s) => (
              <button key={s.key} type="button" aria-pressed={sort === s.key} onClick={() => onSort(s.key)}>{s.label}</button>
            ))}
          </div>
          <span className="ch-note" aria-live="polite">{notes[sort]}</span>
        </div>
      </section>
      <section className="ch-list" aria-label="Channels, ranked">
        {rows.map((r, i) => (
          <div key={r.id} className="ch-row">
            <span className="ch-rank">{String(i + 1).padStart(2, "0")}</span>
            <div className="ch-name">
              <div>{r.name}</div>
              <div>{r.detail} · code {r.code}</div>
            </div>
            <div className="ch-minis">
              <div className="ch-mini"><span>Clicks</span><div className="track"><div style={{ width: w(r.clicks, max.clicks) }} /></div><span>{fmt(r.clicks)}</span></div>
              <div className="ch-mini is-door"><span>At door</span><div className="track"><div style={{ width: w(r.door, max.door) }} /></div><span>{fmt(r.door)}</span></div>
              <div className="ch-mini is-rev"><span>Revenue</span><div className="track"><div style={{ width: w(r.revCents, max.rev) }} /></div><span>{money(r.revCents)}</span></div>
            </div>
            <div className="ch-verdict">
              <VerdictPill verdict={r.verdict} />
              <span>{r.clicks ? `${(r.rate * 100).toFixed(1)}% click → door` : "no clicks yet"}</span>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
