import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/ui/Logo";
import { CONTACT } from "@/data/site";
import "./legal.css";

/** A plain-language page on the white canvas: privacy notice, pilot terms. */
export function LegalPage({ kicker, title, updated, children }: { kicker: string; title: string; updated: string; children: ReactNode }) {
  return (
    <div className="frame">
      <div className="lg-canvas">
        <header className="lg-top">
          <Link href="/" aria-label="Profit Monitr — home"><Logo size={28} /></Link>
          <nav className="lg-nav" aria-label="Legal">
            <Link href="/privacy">Privacy</Link>
            <Link href="/pilot-terms">Pilot terms</Link>
          </nav>
        </header>
        <article className="lg-body">
          <div className="kicker">{kicker}</div>
          <h1>{title}</h1>
          <p className="lg-updated">Last updated {updated}</p>
          {children}
          {/* The contact section appears once CONTACT.email is set (README → "Before launch"); an empty promise is worse than none. */}
          {CONTACT.email && (
            <section>
              <h2>Questions</h2>
              <p>Write to <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>{CONTACT.entity ? ` (${CONTACT.entity})` : ""}.</p>
            </section>
          )}
        </article>
      </div>
    </div>
  );
}
