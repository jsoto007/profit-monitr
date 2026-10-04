import Link from "next/link";
import { CheckIcon } from "@/components/ui/icons";
import { Logo } from "@/components/ui/Logo";
import { Rich } from "@/components/ui/Rich";
import { ACTIONS, DEMO, PAST_ACTIONS } from "@/data/sample";
import { CONTACT, SITE } from "@/data/site";
import { sampleRange } from "@/lib/dashboard/sample";
import { fmt, money } from "@/lib/util";
import "./brief.css";

/**
 * A complete Monday brief for the fictional sample venue, rendered from the
 * same sample provider the demo dashboard uses — so the public page and the
 * demo never disagree. Replace with a redacted real brief once a pilot allows it.
 */
export function SampleBrief() {
  const { metrics: m, channels } = sampleRange("week");
  const max = Math.max(...m.chart.bars.map((b) => b.value));
  const best = [...channels].sort((a, b) => b.revCents - a.revCents)[0];
  const perDollar = [...channels].filter((c) => c.roi !== "free").sort((a, b) => parseFloat(b.roi) - parseFloat(a.roi))[0];
  return (
    <div className="frame">
      <div className="br-canvas">
        <header className="br-top">
          <Link href="/" aria-label="Profit Monitr — home"><Logo size={28} /></Link>
          <span className="br-fictional">Fictional sample venue · illustrative numbers</span>
        </header>

        <article className="br-body">
          <div className="kicker">THE MONDAY BRIEF · {DEMO.venue.toUpperCase()} · {m.rangeLabel}</div>
          <h1 className="br-h1">Your marketing made <span className="br-figure">{money(m.revCents)}</span> in sales.</h1>
          <p className="br-summary">{m.summary}</p>

          <section className="br-chart" aria-label={m.chart.title}>
            <div className="br-chart-head">
              <b>{m.chart.title}</b>
              <span>{m.chart.note}</span>
            </div>
            <div className="br-bars" role="img" aria-label={`${m.chart.title}: ${m.chart.bars.map((b) => `${b.label} ${money(b.value)}`).join(", ")}`}>
              {m.chart.bars.map((b) => (
                <div key={b.label} className="br-bar">
                  <div className="br-bar-fill" style={{ height: `${Math.round((b.value / max) * 100)}%` }} />
                  <span>{b.label}</span>
                </div>
              ))}
            </div>
          </section>

          <section aria-labelledby="glance">
            <h2 id="glance" className="br-h2">At a glance</h2>
            <div className="br-kpis">
              <div className="br-kpi"><span>Reservations</span><b>{fmt(m.res)}</b><small>{m.deltas.res} vs previous</small></div>
              <div className="br-kpi"><span>Tickets sold</span><b>{fmt(m.tix)}</b><small>{m.deltas.tix} vs previous</small></div>
              <div className="br-kpi"><span>Guests at the door</span><b>{fmt(m.door)}</b><small>{m.showRate} of bookings showed up</small></div>
              <div className="br-kpi"><span>Return on marketing</span><b>{m.roi}</b><small>on {money(m.spendCents)} spent</small></div>
            </div>
          </section>

          <section className="br-pod br-lavender" aria-labelledby="why">
            <h2 id="why" className="br-h2">Why it happened</h2>
            <ol className="br-why">
              {m.why.map((w, i) => (
                <li key={i}><span className="br-why-n">{i + 1}</span><span><Rich text={w} /></span></li>
              ))}
            </ol>
            <p className="br-note">{best.name} brought the most money ({money(best.revCents)}). {perDollar.name} brought the most per dollar ({perDollar.roi}).</p>
          </section>

          <section className="br-pod br-dark on-dark" aria-labelledby="do">
            <div className="kicker">DO THIS WEEK</div>
            <h2 id="do" className="br-h2">Three moves, ranked by what they&apos;re worth</h2>
            <ol className="br-actions">
              {ACTIONS.map((a, i) => (
                <li key={a.title}>
                  <span className="br-action-n">{i + 1}</span>
                  <div>
                    <b>{a.title}</b>
                    <p>{a.description}</p>
                    <small>{a.estimate}</small>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="past">
            <h2 id="past" className="br-h2">Last week&apos;s moves</h2>
            <ul className="br-past">
              {PAST_ACTIONS.map((p) => (
                <li key={p.title} className={p.status === "done" ? "is-done" : undefined}>
                  <CheckIcon stroke={3} />
                  <span><b>{p.title}</b> {p.result}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="br-legend" aria-labelledby="legend">
            <h2 id="legend" className="br-h2">What these numbers can prove</h2>
            <ul>
              <li><b>Measured exactly:</b> bookings made on your Monitr booking page and guests checked in at the door.</li>
              <li><b>As your platform reports it:</b> ticket orders uploaded from Posh or Eventbrite, matched by promo code or tracking link.</li>
              <li><b>Clicks:</b> taps on your tracked links. A click is a click, never a booking.</li>
            </ul>
            <p>This brief is for a fictional venue, with numbers chosen to show every part of the page. Yours will be built from your own activity only.</p>
          </section>

          <section className="br-cta">
            <h2 className="br-h2">Want one of these for your venue?</h2>
            <div className="br-cta-row">
              {CONTACT.callUrl && <a href={CONTACT.callUrl} className="btn" target="_blank" rel="noopener noreferrer">Book a 15-minute call</a>}
              <Link href="/signup" className={CONTACT.callUrl ? "btn btn-secondary" : "btn"}>Start a free pilot</Link>
              <form action="/api/auth/demo" method="post">
                <button type="submit" className="btn btn-secondary">Explore the demo venue</button>
              </form>
            </div>
            <p className="br-cta-line">{SITE.pilotLine}</p>
          </section>
        </article>
      </div>
    </div>
  );
}
