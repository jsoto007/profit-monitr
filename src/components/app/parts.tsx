import type { ReactNode } from "react";
import type { Bar, ChannelVerdict, Verdict } from "@/lib/dashboard/types";
import { pct } from "@/lib/util";

type KpiProps = { label: string; value: ReactNode; note?: ReactNode; up?: boolean; mint?: boolean; text?: boolean; onClick?: () => void };

/** KPI card: label, big tabular number, one line of context. A button when it leads somewhere. */
export function Kpi({ label, value, note, up, mint, text, onClick }: KpiProps) {
  const body = (
    <>
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value${text ? " text" : ""}`}>{value}</div>
      {note ? <div className={`kpi-note${up ? " up" : ""}`}>{note}</div> : null}
    </>
  );
  const cls = `kpi${mint ? " mint" : ""}`;
  return onClick ? (
    <button type="button" className={cls} onClick={onClick}>{body}</button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** "+18% vs previous", or a neutral line when there is nothing to compare with yet. */
export function delta(d: string): { note: string; up: boolean } {
  return d ? { note: `${d} vs previous`, up: d.startsWith("+") } : { note: "no previous period yet", up: false };
}

/** Pill-bar chart. The tallest bar is inked; `format` describes each bar to screen readers. */
export function Bars({ bars, label, strong, format }: { bars: Bar[]; label: string; strong?: boolean; format: (n: number) => string }) {
  const max = Math.max(0, ...bars.map((b) => b.value));
  return (
    <>
      <div className={`bars${strong ? " strong" : ""}`} role="img" aria-label={`${label}: ${bars.map((b) => `${b.label} ${format(b.value)}`).join(", ")}`}>
        {bars.map((b) => (
          <div key={b.label} className={max > 0 && b.value === max ? "is-top" : undefined} style={{ height: pct(max ? b.value / max : 0) }} />
        ))}
      </div>
      <div className="bar-labels" aria-hidden="true">
        {bars.map((b) => (
          <span key={b.label} className={max > 0 && b.value === max ? "is-top" : undefined}>{b.label}</span>
        ))}
      </div>
    </>
  );
}

const TONE: Record<Verdict | ChannelVerdict, string> = {
  "Scale it": " good", Working: " good",
  "Fix or cut": " bad", "Not working": " bad",
  "Keep going": "", Steady: "", New: "", "Getting clicks": "",
};

export function VerdictPill({ verdict }: { verdict: Verdict | ChannelVerdict }) {
  return <span className={`verdict${TONE[verdict]}`}>{verdict}</span>;
}
