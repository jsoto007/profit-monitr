"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Logo } from "@/components/ui/Logo";
import { moneyExact } from "@/lib/util";
import "@/components/booking/booking.css";

type Row = { id: string; confirmation: string; guestName: string; partySize: number; kind: string; date: string; promoCode: string; source: string; event: string; amountCents: number; checkedInAt: string | null };
type Status = { ok: boolean; text: string } | null;

/** Recent bookings, or null when the request fails (the list on screen is kept). */
async function fetchRows(q = ""): Promise<Row[] | null> {
  try {
    const res = await fetch(`/api/checkin${q ? `?q=${encodeURIComponent(q)}` : ""}`);
    return res.ok ? (await res.json()).bookings : null;
  } catch {
    return null;
  }
}

/**
 * Door check-in — the step that turns a booking into a "guest at the door".
 * Not in the design handoff; attribution cannot be measured without it.
 */
export function Door({ venue, tz }: { venue: string; tz: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [code, setCode] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const billInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const next = await fetchRows(query.trim());
    if (next) setRows(next);
  }, [query]);
  const search = (e: FormEvent) => {
    e.preventDefault();
    load();
  };
  useEffect(() => {
    let live = true;
    fetchRows().then((next) => {
      if (live && next) setRows(next);
    });
    return () => {
      live = false;
    };
  }, []);

  const call = async (method: "POST" | "DELETE", body: Record<string, string>, done: (data: Record<string, unknown>) => string) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/checkin", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setStatus({ ok: true, text: done(data) });
        setCode("");
        setAmount("");
        await load();
      } else setStatus({ ok: false, text: data.fields?.amount || data.error || "That didn’t work." });
    } catch {
      setStatus({ ok: false, text: "You appear to be offline." });
    }
    setBusy(false);
  };
  const checkIn = (confirmation: string, bill: string) =>
    call("POST", { confirmation, amount: bill }, (d) =>
      d.billUpdated
        ? `${d.guestName} — bill set to ${moneyExact(Number(d.amountCents))}`
        : `${d.guestName} — party of ${d.partySize} checked in${d.promoCode ? ` · code ${d.promoCode}` : ""}${d.amountCents ? ` · ${moneyExact(Number(d.amountCents))}` : ""}`,
    );
  const release = (r: Row) => {
    if (window.confirm(`Release ${r.guestName}'s booking? ${r.kind === "TICKET" ? "The tickets go" : "The table goes"} back on sale.`)) call("DELETE", { confirmation: r.confirmation }, () => `${r.guestName}'s booking was released`);
  };
  /** Puts a row's code in the form so the bill can be typed before it is saved. */
  const pick = (r: Row) => {
    setCode(r.confirmation);
    setAmount("");
    setStatus(null);
    billInput.current?.focus();
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    checkIn(code, amount);
  };
  const when = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  return (
    <div className="frame">
      <div className="bk-canvas">
        <header className="bk-top">
          <Logo size={28} />
          <Link href="/app?tab=live" className="dr-back">← Back to Live</Link>
        </header>
        <main style={{ marginTop: 32 }}>
          <div className="kicker">AT THE DOOR · {venue.toUpperCase()}</div>
          <h1 className="bk-h1">Check a party in.</h1>
          <p className="bk-lede">Enter the guest&apos;s confirmation code. For a table, add the bill — it is credited to the link or code that brought them, and you can correct it later the same way.</p>
          <form onSubmit={submit} className="dr-form" noValidate>
            <label className="field">
              <span>Confirmation code</span>
              <input className="input bk-code" value={code} onChange={(e) => { setCode(e.target.value); setStatus(null); }} placeholder="e.g. THE-7K2QX" autoCapitalize="characters" autoComplete="off" />
            </label>
            <label className="field">
              <span>Bill <span className="optional">(optional)</span></span>
              <input ref={billInput} className="input" value={amount} onChange={(e) => { setAmount(e.target.value); setStatus(null); }} placeholder="184.50" inputMode="decimal" autoComplete="off" />
            </label>
            <button type="submit" className="btn" disabled={busy || !code.trim()}>Save</button>
          </form>
          <div className={`dr-status${status ? (status.ok ? " ok" : " bad") : ""}`} role="status">{status?.text}</div>

          <form onSubmit={search} className="dr-search" role="search">
            <h2 className="db-h2" style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" }}>{query.trim() ? "Search results" : "Still to arrive, then recent arrivals"}</h2>
            <input className="input" type="search" aria-label="Find a booking by code or guest name" placeholder="Find by code or name" value={query} onChange={(e) => setQuery(e.target.value)} />
            <button type="submit" className="btn btn-xs btn-secondary">Find</button>
          </form>
          <div className="dr-list">
            {rows === null ? (
              <div className="dr-row"><span>Loading…</span></div>
            ) : rows.length === 0 ? (
              <div className="dr-row" style={{ display: "block", color: "var(--text-label)" }}>No bookings yet. They appear here the moment a guest books from one of your links.</div>
            ) : (
              rows.map((r) => (
                <div key={r.id} className="dr-row">
                  <code>{r.confirmation}</code>
                  <span><b>{r.guestName}</b><small>{r.kind === "TICKET" ? `${r.partySize} ticket${r.partySize === 1 ? "" : "s"}${r.event ? ` · ${r.event}` : ""}` : `Table for ${r.partySize}`} · {when(r.date)}</small></span>
                  <span>{r.source}<small>{r.promoCode ? `code ${r.promoCode}` : "no code"}{r.amountCents ? ` · ${moneyExact(r.amountCents)}` : ""}</small></span>
                  <span className="dr-actions">
                    {r.checkedInAt ? (
                      <>
                        <span className="verdict good">Checked in</span>
                        {r.kind === "RESERVATION" && <button type="button" className="dr-link" onClick={() => pick(r)}>{r.amountCents ? "Edit bill" : "Add bill"}</button>}
                      </>
                    ) : (
                      <>
                        {/* A table's bill is typed first; a ticket order's amount is already fixed. */}
                        <button type="button" className="btn btn-xs" onClick={() => (r.kind === "TICKET" ? checkIn(r.confirmation, "") : pick(r))} disabled={busy}>Check in</button>
                        <button type="button" className="dr-link" onClick={() => release(r)} disabled={busy}>Release</button>
                      </>
                    )}
                  </span>
                </div>
              ))
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
