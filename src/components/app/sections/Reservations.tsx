"use client";

import { useState, type ChangeEvent } from "react";
import type { ImportRecord, Metrics, Reservations as Data } from "@/lib/dashboard/types";
import { FIELD_LABEL, IMPORT_PROVIDER_KEYS, IMPORT_PROVIDERS, type ImportProvider, type ImportSummary } from "@/lib/import-types";
import { fmt, money, pct } from "@/lib/util";
import { Bars, delta, Kpi } from "../parts";

async function postImport(body: unknown): Promise<{ ok: boolean; data: Partial<ImportSummary> & { error?: string } }> {
  try {
    const res = await fetch("/api/imports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { ok: res.ok, data: await res.json().catch(() => ({})) };
  } catch {
    return { ok: false, data: { error: "You appear to be offline. Check your connection and try again." } };
  }
}

const when = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/**
 * "Upload your platform's orders": choose the platform, pick the CSV, read the
 * dry-run preview, then import. Nothing is written until the second step.
 */
function ImportOrders({ imports, onImported }: { imports: ImportRecord[]; onImported: () => void }) {
  const [provider, setProvider] = useState<ImportProvider>("posh");
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [preview, setPreview] = useState<ImportSummary | null>(null);
  const [done, setDone] = useState<ImportSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const choose = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = ""; // so the same file can be chosen again after Cancel
    if (!f) return;
    setErr("");
    setDone(null);
    setPreview(null);
    const text = await f.text();
    setFile({ name: f.name, text });
    setBusy(true);
    const r = await postImport({ provider, fileName: f.name, csv: text, dryRun: true });
    setBusy(false);
    if (!r.ok) return setErr(r.data.error || "Couldn’t read that file.");
    setPreview(r.data as ImportSummary);
  };
  const commit = async () => {
    if (!file || !preview || busy) return;
    setBusy(true);
    const r = await postImport({ provider, fileName: file.name, csv: file.text, dryRun: false });
    setBusy(false);
    if (!r.ok) return setErr(r.data.error || "That didn’t save — please try again");
    setDone(r.data as ImportSummary);
    setPreview(null);
    setFile(null);
    onImported();
  };
  const p = IMPORT_PROVIDERS[provider];
  const unit = p.kind === "TICKET" ? "orders" : "reservations";
  return (
    <div className="imp">
      <div className="db-head flush">
        <h2 className="db-h2">Upload your platform&apos;s {unit}</h2>
        <a className="btn btn-xs btn-secondary" href="/api/export" download>Export bookings (CSV)</a>
      </div>
      <p className="imp-intro">Monitr sees the click; your platform saw the sale. Its export closes the loop: each order is credited to the promo code or tracking link that earned it. Upload newer exports in date order — the same orders update, nothing is counted twice, and a refund never comes back. Attendance in the file is noted but never counted as a door check-in.</p>
      <div className="au-chips" role="radiogroup" aria-label="Platform">
        {IMPORT_PROVIDER_KEYS.map((k) => (
          <button key={k} type="button" role="radio" aria-checked={provider === k} className="chip" onClick={() => { setProvider(k); setPreview(null); setFile(null); setErr(""); }}>{IMPORT_PROVIDERS[k].label}</button>
        ))}
      </div>
      <p className="imp-hint">Where to find it: {p.hint}</p>
      <label className="imp-file">
        <span className="btn btn-xs">{busy && !preview ? "Reading…" : "Choose CSV file"}</span>
        <input type="file" accept=".csv,text/csv" onChange={choose} disabled={busy} aria-label={`${p.label} export (CSV)`} />
        {file && <span className="imp-file-name">{file.name}</span>}
      </label>
      {err && <div className="field-error" role="alert">{err}</div>}

      {preview && (
        <div className="imp-preview" aria-live="polite">
          <b>{fmt(preview.rows)} {unit} read</b> · {fmt(preview.created)} new · {fmt(preview.updated)} already here{preview.rejected ? ` · ${fmt(preview.rejected)} skipped` : ""}
          {preview.refunded ? ` · ${fmt(preview.refunded)} refunded` : ""}{preview.unpaid ? ` · ${fmt(preview.unpaid)} unpaid (held, not revenue)` : ""}{preview.keptRefunded ? ` · ${fmt(preview.keptRefunded)} stay refunded` : ""}{preview.attended ? ` · ${fmt(preview.attended)} marked attended by the platform` : ""} · {money(preview.revenueCents)} paid
          {preview.missing.length > 0 && (
            <div className="field-error">This file has no {preview.missing.map((f) => FIELD_LABEL[f]).join(" or ")} column. Columns found: {preview.headers.join(", ") || "none"}.</div>
          )}
          {preview.byChannel.length > 0 && (
            <ul className="imp-list">
              {preview.byChannel.map((c, i) => <li key={`${c.name}-${i}`}>{c.name}: {fmt(c.orders)} {c.orders === 1 ? "order" : "orders"} · {money(c.revenueCents)}</li>)}
              {preview.unattributed > 0 && <li>No code or link: {fmt(preview.unattributed)} — counted as platform sales, credited to no source</li>}
            </ul>
          )}
          {preview.byChannel.length === 0 && preview.rows > 0 && preview.missing.length === 0 && (
            <div className="imp-note">None of these {unit} carry one of your promo codes or tracking links, so they will count as platform sales with no source. Give each promoter a code or paste their tracking link under Channels, then upload again.</div>
          )}
          {preview.rejects.length > 0 && (
            <details className="imp-rejects">
              <summary>Skipped lines</summary>
              <ul>{preview.rejects.slice(0, 10).map((r) => <li key={r.line}>Line {r.line}: {r.reason}</li>)}</ul>
            </details>
          )}
          <div className="ch-booking-actions">
            <button type="button" className="btn btn-xs" onClick={commit} disabled={busy || preview.missing.length > 0 || preview.rows === 0}>{busy ? "Importing…" : `Import ${fmt(preview.rows)} ${unit}`}</button>
            <button type="button" className="btn btn-xs btn-secondary" onClick={() => { setPreview(null); setFile(null); }} disabled={busy}>Cancel</button>
          </div>
        </div>
      )}
      {done && <div className="imp-done" role="status">Imported {fmt(done.created)} new and updated {fmt(done.updated)} {unit}. Your numbers are refreshing.</div>}

      {imports.length > 0 && (
        <ul className="imp-history" aria-label="Recent uploads">
          {imports.slice(0, 5).map((h) => (
            <li key={h.id}>{when(h.at)} · {IMPORT_PROVIDERS[h.provider as ImportProvider]?.label ?? h.provider} · {h.fileName || "export"} · {fmt(h.rows)} rows, {fmt(h.created)} new, {fmt(h.updated)} updated{h.unattributed ? `, ${fmt(h.unattributed)} without a source` : ""}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

type Props = { m: Metrics; r: Data; editable: boolean; sample: boolean; imports: ImportRecord[]; onImported: () => void };

export function Reservations({ m, r, editable, sample, imports, onImported }: Props) {
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

      {editable && (
        <section className="pod line" aria-label="Upload orders">
          {sample && <p className="imp-intro"><b>You&apos;re viewing the sample venue.</b> Uploads go to your own venue; switch to your own data (top of the page) to see them.</p>}
          <ImportOrders imports={imports} onImported={onImported} />
        </section>
      )}

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
