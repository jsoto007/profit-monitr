import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import { SITE } from "@/data/site";

export const metadata: Metadata = {
  title: "Pilot terms",
  description: `What a free ${SITE.name} pilot includes, what it costs (nothing), and how it ends.`,
  alternates: { canonical: "/pilot-terms" },
};

/**
 * One page, plain language. Written from what the product actually does;
 * review it before any outreach.
 */
export default function PilotTermsPage() {
  return (
    <LegalPage kicker="PILOT TERMS" title="A free pilot, in plain words." updated="October 3, 2026">
      <p>These are the terms of a {SITE.name} pilot. They are short on purpose.</p>

      <section>
        <h2>What the pilot is</h2>
        <ul>
          <li>You use {SITE.name} for free during the pilot. No card is collected and nothing is charged.</li>
          <li>After the pilot the plan is {SITE.price} a month, everything included — and only if you choose to continue. We will ask you first. Nothing is ever charged without a separate agreement with you.</li>
        </ul>
      </section>

      <section>
        <h2>What we do</h2>
        <ul>
          <li>Give you a tracked link and promo code for every influencer, promoter and campaign, pointing at the booking page you already use.</li>
          <li>Show you clicks, bookings, ticket orders you upload, and guests at the door, credited to the source that earned them, and send you a brief every Monday.</li>
          <li>Label every number by what it can prove: bookings made on our page and door check-ins are measured exactly; orders from your ticketing platform are as its export reports them; clicks are clicks.</li>
        </ul>
      </section>

      <section>
        <h2>What we don&apos;t do</h2>
        <ul>
          <li>We don&apos;t take payments and we don&apos;t move your money.</li>
          <li>We don&apos;t change your Posh, Eventbrite, Resy or OpenTable setup, and we never contact your guests.</li>
          <li>We don&apos;t sell or share your data or your guests&apos; data.</li>
        </ul>
      </section>

      <section>
        <h2>Your data</h2>
        <p>It is yours. Export it from the app whenever you like. Ask and we delete your account and everything under it. How we handle it is in the <a href="/privacy">privacy notice</a>.</p>
      </section>

      <section>
        <h2>How it ends</h2>
        <p>Either of us can end the pilot at any time with an email. If you end it, we delete your data on request. If we end it, we tell you why and give you time to export.</p>
      </section>

      <section>
        <h2>It&apos;s a pilot</h2>
        <p>The product is new and will change while you use it. We will tell you about changes that affect your numbers. We work hard to keep it accurate and available, but during a free pilot we can&apos;t promise either, and we are not liable for business decisions made on it.</p>
      </section>
    </LegalPage>
  );
}
