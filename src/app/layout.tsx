import type { Metadata, Viewport } from "next";
import type { CSSProperties } from "react";
import { Figtree } from "next/font/google";
import Script from "next/script";
import { SITE, siteUrl } from "@/data/site";
import "./globals.css";

/**
 * Cookieless page analytics (Plausible, Umami or similar): the script URL and
 * the site it reports for come from the environment, so nothing loads unless
 * the operator has chosen a provider. No cookies, no consent banner.
 */
const ANALYTICS_SRC = process.env.NEXT_PUBLIC_ANALYTICS_SRC;
const ANALYTICS_DOMAIN = process.env.NEXT_PUBLIC_ANALYTICS_DOMAIN;

const figtree = Figtree({ subsets: ["latin"], display: "swap" });
// Only the Figtree face itself goes into the stack (see --font-sans in tokens.css). next/font
// also offers a re-metricked Arial fallback, but glyphs Figtree lacks (→, ≈) must fall through
// to system-ui exactly as in the design reference.
const figtreeFamily = figtree.style.fontFamily.split(",")[0].trim();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: `${SITE.name} — Track what drives sales and reservations`, template: `%s — ${SITE.name}` },
  description: SITE.description,
  applicationName: SITE.name,
  openGraph: { type: "website", siteName: SITE.name, title: `${SITE.name} — Track what drives sales and reservations`, description: SITE.description, url: "/" },
  twitter: { card: "summary_large_image", title: `${SITE.name} — Track what drives sales and reservations`, description: SITE.description },
};

export const viewport: Viewport = { themeColor: "#111111" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" style={{ "--font-figtree": figtreeFamily } as CSSProperties} data-scroll-behavior="smooth">
      <body>
        {children}
        {ANALYTICS_SRC && <Script src={ANALYTICS_SRC} data-domain={ANALYTICS_DOMAIN} data-website-id={ANALYTICS_DOMAIN} strategy="afterInteractive" />}
      </body>
    </html>
  );
}
