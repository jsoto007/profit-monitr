"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { CheckIcon } from "@/components/ui/icons";
import { firstName, moneyExact } from "@/lib/util";
import "./booking.css";

type Kind = "RESERVATION" | "TICKET";
type Venue = { name: string; slug: string; city: string; type: string; timezone: string };
type Via = { slug: string; code: string; discountPct: number | null; content: string } | null;
export type TicketEvent = { id: string; name: string; when: string; priceCents: number; left: number };
type Done = { confirmation: string; discountPct: number | null; amountCents: number; date: string };

/**
 * The venue's public booking page — where every tracked link lands. A booking
 * is credited to the link that brought the guest (`via`) or to the promo code
 * they type, and shows up on the venue's Live screen straight away.
 */
export function BookingForm({ venue, via, kinds, events, today }: { venue: Venue; via: Via; kinds: Kind[]; events: TicketEvent[]; today: string }) {
  const [kind, setKind] = useState<Kind>(kinds[0]);
  const [f, setF] = useState({ name: "", email: "", party: "2", date: "", time: "19:00", code: via?.code ?? "", eventId: events[0]?.id ?? "" });
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const set = (k: keyof typeof f, v: string) => {
    setF((s) => ({ ...s, [k]: v }));
    setErr((e) => ({ ...e, [k]: "", form: "" }));
  };
  const ticket = kind === "TICKET";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/public/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venue: venue.slug, via: via?.slug ?? "", c: via?.content ?? "", kind, eventId: f.eventId, name: f.name, email: f.email, party: Number(f.party), date: f.date, time: f.time, code: f.code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setErr(data.fields || { form: data.error || "Something went wrong. Please try again." });
      else setDone(data);
    } catch {
      setErr({ form: "You appear to be offline. Check your connection and try again." });
    }
    setBusy(false);
  };

  const field = (name: keyof typeof f, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="field">
      <span>{label}</span>
      <input name={name} value={f[name]} onChange={(e) => set(name, e.target.value)} className={`input${err[name] ? " is-error" : ""}`} aria-invalid={!!err[name]} {...props} />
      <span className="field-error" role="alert">{err[name]}</span>
    </label>
  );
  const when = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone: venue.timezone, weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  return (
    <div className="frame">
      <div className="bk-canvas">
        <header className="bk-top">
          <span className="bk-venue">{venue.name}</span>
          <span className="bk-top-meta">{[venue.type, venue.city].filter(Boolean).join(" · ")}</span>
        </header>

        <main className="bk-grid">
          <div>
            <div className="kicker">{ticket ? "TICKETS" : "RESERVATIONS"}</div>
            <h1 className="bk-h1">{ticket ? "Get your tickets." : "Book a table."}</h1>
            <p className="bk-lede">
              {via ? (
                <>You&apos;re booking with code <b>{via.code}</b>{via.discountPct ? ` — ${via.discountPct}% off ${ticket ? "your tickets" : "your bill"}` : ""}. It&apos;s applied automatically.</>
              ) : (
                <>Pick a date, tell us who&apos;s coming and we&apos;ll hold your spot.</>
              )}
            </p>
            {kinds.length > 1 && !done && (
              <div className="seg bk-kind" role="group" aria-label="What would you like to book?">
                <button type="button" aria-pressed={!ticket} onClick={() => setKind("RESERVATION")}>Reservation</button>
                <button type="button" aria-pressed={ticket} onClick={() => setKind("TICKET")}>Tickets</button>
              </div>
            )}
          </div>

          <div className="bk-card">
            {done ? (
              <div className="bk-done" role="status">
                <div className="bk-badge"><CheckIcon size={30} stroke={3} /></div>
                <h2>You&apos;re booked, {firstName(f.name)}.</h2>
                <p>Show this code at the door{done.discountPct && !ticket ? ` for ${done.discountPct}% off your bill` : ""}:</p>
                <div className="bk-confirmation">{done.confirmation}</div>
                <p>
                  {venue.name} · {ticket ? `${f.party} ticket${f.party === "1" ? "" : "s"}` : `Table for ${f.party}`} · {when(done.date)}
                  {done.amountCents ? ` · ${moneyExact(done.amountCents)} to pay at the door${done.discountPct ? ` (${done.discountPct}% off applied)` : ""}` : ""}
                </p>
              </div>
            ) : (
              <form onSubmit={submit} noValidate className="bk-form">
                {ticket && (
                  <div className="au-group" role="radiogroup" aria-label="Event">
                    <div className="bk-events">
                      {events.map((ev) => (
                        <button key={ev.id} type="button" role="radio" aria-checked={f.eventId === ev.id} className="bk-event" onClick={() => set("eventId", ev.id)} disabled={ev.left <= 0}>
                          {ev.name}
                          <span>{ev.when} · {ev.left > 0 ? (ev.priceCents ? moneyExact(ev.priceCents) : "Free") : "Sold out"}</span>
                        </button>
                      ))}
                    </div>
                    <span className="field-error" role="alert">{err.eventId}</span>
                  </div>
                )}
                {field("name", "Your name", { autoComplete: "name", placeholder: "Alex Rivera" })}
                {field("email", "Email (for your confirmation)", { type: "email", autoComplete: "email", placeholder: "you@example.com" })}
                {ticket ? (
                  field("party", "Tickets", { type: "number", min: 1, max: 10, inputMode: "numeric" })
                ) : (
                  <>
                    <div className="bk-two">
                      {field("party", "Guests", { type: "number", min: 1, max: 40, inputMode: "numeric" })}
                      {field("date", "Date", { type: "date", min: today })}
                    </div>
                    {field("time", "Time", { type: "time" })}
                  </>
                )}
                {field("code", "Promo code (optional)", { placeholder: "e.g. MARIA10", className: `input bk-code${err.code ? " is-error" : ""}`, autoCapitalize: "characters" })}
                <span className="field-error" role="alert">{err.form}</span>
                <button type="submit" className="btn" style={{ justifySelf: "start" }} disabled={busy}>{ticket ? "Get tickets →" : "Book my table →"}</button>
              </form>
            )}
          </div>
        </main>

        <footer className="bk-foot">
          <span>Bookings for {venue.name}</span>
          <Link href="/">Powered by Profit Monitr</Link>
        </footer>
      </div>
    </div>
  );
}
