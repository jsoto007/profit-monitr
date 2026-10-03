import Link from "next/link";
import { Cormorant_Garamond } from "next/font/google";
import { CheckIcon } from "@/components/ui/icons";
import { Logo } from "@/components/ui/Logo";
import { AGENTS, BRIEF, CLOSE, HERO, HOW, NAV, PRICING, PROMISES } from "@/data/landing";
import { SITE } from "@/data/site";
import { HeroFilm } from "./HeroFilm";
import "./landing.css";

/** The brand lockup's serif — only the hero film's closing card uses it. */
const cormorant = Cormorant_Garamond({ subsets: ["latin"], weight: "600", variable: "--font-cormorant", display: "swap" });

export function Landing() {
  return (
    <div className={`frame ${cormorant.variable}`}>
      <div className="ld-canvas">
        <header className="ld-header">
          <nav className="ld-nav" aria-label="Main">
            <Link href="/" className="ld-home" aria-label="Profit Monitr — home">
              <Logo size={30} text={21} />
            </Link>
            <div className="ld-nav-links">
              {NAV.map((l) => (
                <a key={l.href} href={l.href}>{l.label}</a>
              ))}
            </div>
            <div className="ld-nav-cta">
              <Link href="/login" className="ld-pill ld-pill-outline">Log in</Link>
              <Link href="/signup" className="ld-pill ld-pill-solid">Start · {SITE.price}/mo</Link>
            </div>
          </nav>
        </header>

        <main>
          <section className="ld-hero">
            <div>
              <span className="ld-tag"><span className="dot" />{HERO.tag}</span>
              <h1 className="ld-h1">
                Don&apos;t just track likes. Track what drives <span className="ld-mark ld-mark-mint">sales</span> and <span className="ld-mark ld-mark-lavender">reservations</span>.
              </h1>
              <p className="ld-hero-body">{HERO.body}</p>
              <div className="ld-cta-row">
                <Link href="/signup" className="ld-pill ld-pill-solid">{HERO.primary}</Link>
                <a href="#how" className="ld-pill ld-pill-outline">{HERO.secondary}</a>
              </div>
              <div className="ld-footnotes">
                {HERO.footnotes.flatMap((f, i) => (i ? [<span key={`d${i}`} aria-hidden="true">·</span>, <span key={f}>{f}</span>] : [<span key={f}>{f}</span>]))}
              </div>
            </div>
            <div className="ld-phone-col">
              <div className="ld-phone">
                <div className="ld-screen">
                  <HeroFilm />
                </div>
              </div>
              <span className="ld-film-caption">{HERO.filmCaption}</span>
            </div>
          </section>

          <section className="ld-promises" aria-label="What you get">
            {PROMISES.map((p) => (
              <div key={p.n} className={`ld-pod ld-pod-${p.tone}`}>
                <div className="ld-pod-n">{p.n}</div>
                <h2 className="ld-pod-title">{p.title}</h2>
                <p>{p.body}</p>
              </div>
            ))}
          </section>

          <section id="how" className="ld-alt">
            <div className="ld-wrap">
              <div className="ld-head-row">
                <div>
                  <div className="kicker">{HOW.kicker}</div>
                  <h2 className="ld-h2" style={{ maxWidth: "16ch" }}>{HOW.title}</h2>
                </div>
                <p>{HOW.intro}</p>
              </div>
              <ol className="ld-cards" style={{ listStyle: "none", padding: 0, marginBottom: 0 }}>
                {HOW.steps.map((s, i) => (
                  <li key={s.title} className="ld-card ld-step">
                    <span className="ld-step-n">{i + 1}</span>
                    <h3 className="ld-step-title">{s.title}</h3>
                    <p>{s.body}</p>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          <section id="brief" className="ld-wrap ld-brief">
            <div>
              <div className="kicker">{BRIEF.kicker}</div>
              <h2 className="ld-h2" style={{ maxWidth: "14ch" }}>{BRIEF.title}</h2>
              <p className="ld-brief-body">{BRIEF.body}</p>
              <div className="ld-brief-rows">
                {BRIEF.rows.map((r) => (
                  <div key={r.label} className="ld-brief-row">
                    <b>{r.label}</b>
                    <span>{r.note}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="ld-dark-card">
              <div className="ld-dark-meta">
                <span>{BRIEF.card.meta}</span>
                <span className="ld-dark-delta">{BRIEF.card.delta}</span>
              </div>
              <div className="ld-dark-headline">{BRIEF.card.headline}</div>
              <div className="ld-dark-bars" role="img" aria-label="Revenue by day, Monday to Sunday. Saturday is the tallest bar.">
                {BRIEF.card.bars.map((h, i) => (
                  <div key={i} className={i === BRIEF.card.highlight ? "is-top" : undefined} style={{ height: `${h}%` }} />
                ))}
              </div>
              <div className="ld-dark-kicker">{BRIEF.card.kicker}</div>
              <div className="ld-dark-actions">
                {BRIEF.card.actions.map((a) => (
                  <div key={a.bold} className="ld-dark-action">
                    <span><b>{a.bold}</b>{a.rest}</span>
                    <span>{a.est}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section id="agents" className="ld-alt">
            <div className="ld-wrap">
              <div className="kicker">{AGENTS.kicker}</div>
              <h2 className="ld-h2" style={{ maxWidth: "20ch" }}>{AGENTS.title}</h2>
              <div className="ld-cards">
                {AGENTS.cards.map((c) => (
                  <div key={c.name} className="ld-card ld-agent">
                    <div className="ld-agent-name">{c.name}</div>
                    <div className="ld-agent-figure">{c.before} <span>{c.after}</span></div>
                    <p>{c.body}</p>
                  </div>
                ))}
              </div>
              <div className="ld-footnote">{AGENTS.footnote}</div>
            </div>
          </section>

          <section id="pricing" className="ld-wrap">
            <div className="ld-pricing">
              <div>
                <div className="kicker">{PRICING.kicker}</div>
                <div className="ld-price-row">
                  <span className="ld-price">{PRICING.price}</span>
                  <span className="ld-price-per">{PRICING.per}</span>
                </div>
                <p className="ld-pricing-body">{PRICING.body}</p>
                <div className="ld-pricing-cta">
                  <Link href="/signup" className="ld-pill ld-pill-solid">{PRICING.primary}</Link>
                  {/* A POST, not a link: opening the demo signs the visitor into the demo venue. */}
                  <form action="/api/auth/demo" method="post">
                    <button type="submit" className="ld-pill ld-pill-outline">{PRICING.secondary}</button>
                  </form>
                </div>
              </div>
              <ul className="ld-features">
                {PRICING.features.map((f) => (
                  <li key={f}><CheckIcon />{f}</li>
                ))}
              </ul>
            </div>
          </section>
        </main>

        <footer className="ld-close on-dark">
          <div className="ld-close-grid">
            <h2>{CLOSE.title} <span>{CLOSE.accent}</span></h2>
            <div className="ld-close-side">
              <p>{CLOSE.body}</p>
              <Link href="/signup" className="ld-pill ld-pill-white">{CLOSE.cta}</Link>
            </div>
          </div>
          <div className="ld-footer">
            <Logo size={22} text={16} reverse gap={8} />
            <span>© {SITE.year}</span>
            <span className="ld-footer-links">
              <Link href="/login">Log in</Link>
              <Link href="/signup">Create account</Link>
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
