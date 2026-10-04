import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import { SITE } from "@/data/site";

export const metadata: Metadata = {
  title: "Privacy",
  description: `What ${SITE.name} collects, why, and how to have it deleted.`,
  alternates: { canonical: "/privacy" },
};

/**
 * Written from what the app actually does (see src/lib and prisma/schema.prisma).
 * Review it before any outreach; it is a product description, not legal advice.
 */
export default function PrivacyPage() {
  return (
    <LegalPage kicker="PRIVACY NOTICE" title="What we collect, and why." updated="October 3, 2026">
      <p>{SITE.name} shows a venue which of its marketing fills the room. To do that it keeps the data below, uses it only for that venue&apos;s dashboard and Monday brief, and deletes it when the venue asks.</p>

      <section>
        <h2>What we keep</h2>
        <ul>
          <li><b>Your account:</b> your name, email address and a one-way hash of your password. Never the password itself.</li>
          <li><b>Your venue:</b> its name, type, city, website, time zone, the booking page your links point at, and the tracked links and promo codes you create.</li>
          <li><b>Clicks on your tracked links:</b> the time, the browser&apos;s user-agent string and the page the click came from. The visitor&apos;s IP address is used only in memory to count one tap per half hour; it is not stored.</li>
          <li><b>Bookings made on your booking page</b> (if you use ours): the guest&apos;s name, the email they chose to give, party size, date, the promo code and the confirmation code. Door check-ins and the bill you enter at the door.</li>
          <li><b>Orders you upload</b> from your ticketing platform: the order id, timestamp, amount, promo code or tracking link, and the guest name and email as they appear in your export.</li>
          <li><b>Decisions you make in the app:</b> actions you approve, website recommendations you approve, and requests for a strategy session.</li>
        </ul>
      </section>

      <section>
        <h2>Cookies and analytics</h2>
        <p>Signed-in owners get one session cookie, used only to keep you logged in. Guests who click a tracked link or book a table get no cookie at all. If page analytics are enabled on this site they are cookieless and report page views without personal identifiers.</p>
      </section>

      <section>
        <h2>Guests</h2>
        <p>Your guests&apos; details are processed on your behalf so that you can see where they came from and check them in at the door. We never contact your guests, and we never sell or share their details. Telling your guests how their booking data is used is your responsibility as the venue.</p>
      </section>

      <section>
        <h2>Who else sees it</h2>
        <p>Only the services that run the product: the hosting provider the app and its database run on, the email provider that delivers your Monday brief (if configured), and the analytics provider (if enabled). None of them is given your data for any other purpose.</p>
      </section>

      <section>
        <h2>Export and deletion</h2>
        <p>You can export your bookings and guests from the app at any time. Ask us to delete your account and the venue, its links, clicks, bookings, uploads and decisions are removed with it.</p>
      </section>
    </LegalPage>
  );
}
