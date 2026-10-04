"use client";

import { useState, type FormEvent } from "react";
import type { ChannelRow, SortKey } from "@/lib/dashboard/types";
import { fidelityNote, PROVIDERS, type Provider } from "@/lib/destinations";
import { fmt, money, pct } from "@/lib/util";
import { VerdictPill } from "../parts";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "clicks", label: "Clicks" },
  { key: "door", label: "Guests at the door" },
  { key: "rev", label: "Revenue" },
  { key: "rate", label: "Conversion" },
];
const VALUE: Record<SortKey, (c: ChannelRow) => number> = { clicks: (c) => c.clicks, door: (c) => c.door, rev: (c) => c.revCents, rate: (c) => c.rate };

/** The booking-page choices, in the order the sign-up form shows them. */
const CHOICES: Provider[] = ["native", "posh", "eventbrite", "resy", "opentable", "partiful", "website"];
const choiceLabel = (p: Provider) => (p === "native" ? "Monitr's booking page" : p === "website" ? "My own website" : PROVIDERS[p].label);

export type Booking = { provider: Provider; url: string; websiteVerified: boolean };
/** Returns the field error to show, or null when saved. */
export type Save<T> = (value: T) => Promise<string | null>;

type Props = {
  rangeLabel: string;
  channels: ChannelRow[];
  notes: Record<SortKey, string>;
  sort: SortKey;
  onSort: (s: SortKey) => void;
  booking: Booking;
  /** the booking page is a venue setting: editable in sample mode too, never for the read-only demo */
  editable: boolean;
  /** per-row destinations exist only on the venue's own rows, not the sample venue's */
  rowsEditable: boolean;
  onBooking: Save<Booking>;
  onDestination: (id: string, destination: string) => Promise<string | null>;
};

/** "Where your links send people" — the venue's booking page, editable in place. */
function BookingPage({ booking, editable, onBooking }: Pick<Props, "booking" | "editable" | "onBooking">) {
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<Provider>(booking.provider);
  const [url, setUrl] = useState(booking.url);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const problem = await onBooking({ provider, url: provider === "native" ? "" : url, websiteVerified: booking.websiteVerified });
    setBusy(false);
    if (problem) return setErr(problem);
    setErr("");
    setOpen(false);
  };
  const pending = booking.provider === "website" && !!booking.url && !booking.websiteVerified;
  return (
    <div className="ch-booking">
      <div className="ch-booking-row">
        <span><b>Your links send people to</b> {choiceLabel(booking.provider)}{booking.url ? <> · <a href={booking.url} target="_blank" rel="noopener noreferrer">{booking.url}</a></> : null}</span>
        {editable && !open && <button type="button" className="btn btn-xs btn-secondary" onClick={() => setOpen(true)}>Change</button>}
      </div>
      {pending && <div className="ch-booking-note">We check a venue&apos;s own site before links go live there — usually within a day. Until then your links use Monitr&apos;s booking page.</div>}
      {open && (
        <form className="ch-booking-form" onSubmit={submit} noValidate>
          <div className="au-chips" role="radiogroup" aria-label="Where do guests book today?">
            {CHOICES.map((p) => (
              <button key={p} type="button" role="radio" aria-checked={provider === p} className="chip" onClick={() => { setProvider(p); setErr(""); }}>{choiceLabel(p)}</button>
            ))}
          </div>
          {provider !== "native" && (
            <label className="field">
              <span>Your booking page</span>
              <input className={`input${err ? " is-error" : ""}`} inputMode="url" value={url} onChange={(e) => { setUrl(e.target.value); setErr(""); }} placeholder="https://" aria-invalid={!!err} />
              <span className="field-error" role="alert">{err}</span>
            </label>
          )}
          <div className="ch-booking-actions">
            <button type="submit" className="btn btn-xs" disabled={busy}>Save</button>
            <button type="button" className="btn btn-xs btn-secondary" onClick={() => { setOpen(false); setErr(""); setProvider(booking.provider); setUrl(booking.url); }}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}

/** One row's own destination: the platform's tracking link for this promoter or campaign. */
function Destination({ row, editable, onDestination }: { row: ChannelRow; editable: boolean; onDestination: Props["onDestination"] }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(row.destination);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async (next: string) => {
    if (busy) return;
    setBusy(true);
    const problem = await onDestination(row.id, next);
    setBusy(false);
    if (problem) return setErr(problem);
    setErr("");
    setValue(next);
    setOpen(false);
  };
  return (
    <div className="ch-dest">
      <span>→ {row.destination ? <a href={row.destination} target="_blank" rel="noopener noreferrer">{PROVIDERS[row.provider].label} link</a> : `${choiceLabel(row.provider)}`}</span>
      {editable && !open && <button type="button" className="text-link" onClick={() => setOpen(true)}>{row.destination ? "Edit link" : "Own link"}</button>}
      {open && (
        <form className="ch-dest-form" onSubmit={(e) => { e.preventDefault(); save(value); }} noValidate>
          <input className={`input input-tight${err ? " is-error" : ""}`} inputMode="url" value={value} onChange={(e) => { setValue(e.target.value); setErr(""); }} placeholder="Paste this source's tracking link on Posh, Eventbrite, Resy or OpenTable" aria-label={`Tracking link for ${row.name}`} aria-invalid={!!err} />
          <div className="ch-booking-actions">
            <button type="submit" className="btn btn-xs" disabled={busy}>Save</button>
            {row.destination && <button type="button" className="btn btn-xs btn-secondary" disabled={busy} onClick={() => save("")}>Use booking page</button>}
            <button type="button" className="btn btn-xs btn-secondary" onClick={() => { setOpen(false); setErr(""); setValue(row.destination); }}>Cancel</button>
          </div>
          <span className="field-error" role="alert">{err}</span>
        </form>
      )}
    </div>
  );
}

export function Channels({ rangeLabel, channels, notes, sort, onSort, booking, editable, rowsEditable, onBooking, onDestination }: Props) {
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
        <BookingPage key={`${booking.provider}|${booking.url}`} booking={booking} editable={editable} onBooking={onBooking} />
      </section>
      <section className="ch-list" aria-label="Channels, ranked">
        {rows.map((r, i) => {
          const clicksOnly = r.fidelity === "clicks";
          return (
            <div key={r.id} className={`ch-row${clicksOnly ? " is-clicks" : ""}`}>
              <span className="ch-rank">{String(i + 1).padStart(2, "0")}</span>
              <div className="ch-name">
                <div>{r.name}</div>
                <div>{r.detail} · code {r.code}</div>
                <Destination key={r.destination} row={r} editable={rowsEditable} onDestination={onDestination} />
              </div>
              <div className="ch-minis">
                <div className="ch-mini"><span>Clicks</span><div className="track"><div style={{ width: w(r.clicks, max.clicks) }} /></div><span>{fmt(r.clicks)}</span></div>
                <div className="ch-mini is-door"><span>At door</span><div className="track"><div style={{ width: clicksOnly ? "0%" : w(r.door, max.door) }} /></div><span>{clicksOnly ? "—" : fmt(r.door)}</span></div>
                <div className="ch-mini is-rev"><span>Revenue</span><div className="track"><div style={{ width: clicksOnly ? "0%" : w(r.revCents, max.rev) }} /></div><span>{clicksOnly ? "—" : money(r.revCents)}</span></div>
              </div>
              <div className="ch-verdict">
                <VerdictPill verdict={r.verdict} />
                <span>
                  {clicksOnly
                    ? fidelityNote(r.fidelity, r.provider)
                    : !r.clicks
                      ? "no clicks yet"
                      : r.fidelity === "platform"
                        ? `${(r.rate * 100).toFixed(1)}% click → order · as ${PROVIDERS[r.provider].label} reports`
                        : `${(r.rate * 100).toFixed(1)}% click → door`}
                </span>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
