/** Brand and site-wide facts. Client-editable. */
export const SITE = {
  name: "Profit Monitr",
  short: "Monitr",
  tagline: "Don't just track likes. Track what drives sales and reservations.",
  description:
    "Profit Monitr ties every reservation, ticket and sale back to the post, link or campaign that earned it — then tells restaurants, bars and venues, every Monday, exactly what to do next. $39.99 a month, everything included.",
  price: "$39.99",
  year: 2026,
} as const;

/**
 * Public origin, used for canonical URLs, the sitemap, Open Graph and links in
 * emails. APP_URL wins; on Render the service's own URL is the fallback.
 */
export function siteUrl(): string {
  return (process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || "http://localhost:3000").replace(/\/$/, "");
}
