/** Brand and site-wide facts. Client-editable. */
export const SITE = {
  name: "Profit Monitr",
  short: "Monitr",
  tagline: "Don't just track likes. Track what drives sales and reservations.",
  description:
    "Profit Monitr sits on top of the booking page a venue already uses — Posh, Eventbrite, Resy, OpenTable or its own site — and ties every ticket, reservation and guest at the door back to the post, promoter or campaign that earned it. Every Monday it tells bars, clubs, event venues and restaurants exactly what to do next. Free during the pilot; $39.99 a month after.",
  price: "$39.99",
  /** The one line about money, used wherever the price appears. */
  pilotLine: "Free during the pilot; $39.99 a month after, only if you choose to continue.",
  year: 2026,
} as const;

/**
 * Who stands behind the product. Every field is optional and nothing is
 * rendered for an empty one — fill these in before any outreach (README →
 * "Before launch"). Never invent them.
 */
export const CONTACT = {
  founder: "",
  /** Legal entity, e.g. "SotoDev LLC". */
  entity: "",
  email: "",
  /** Scheduling link for the 15-minute call ("Book a 15-minute call" appears only when set). */
  callUrl: "",
} as const;

/**
 * Public origin, used for canonical URLs, the sitemap, Open Graph and links in
 * emails. APP_URL wins; on Render the service's own URL is the fallback.
 */
export function siteUrl(): string {
  return (process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || "http://localhost:3000").replace(/\/$/, "");
}
