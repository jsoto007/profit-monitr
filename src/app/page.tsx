import type { Metadata } from "next";
import { Landing } from "@/components/landing/Landing";
import { PRICING } from "@/data/landing";
import { SITE, siteUrl } from "@/data/site";

export const metadata: Metadata = { alternates: { canonical: "/" } };

export default function HomePage() {
  const url = siteUrl();
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", "@id": `${url}/#org`, name: SITE.name, url, logo: `${url}/logo/profit-monitr-mark.svg` },
      {
        "@type": "SoftwareApplication",
        name: SITE.name,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url,
        description: SITE.description,
        audience: { "@type": "BusinessAudience", audienceType: "Bars, clubs, event venues and restaurants" },
        featureList: PRICING.features,
        offers: { "@type": "Offer", price: "39.99", priceCurrency: "USD", description: "Free during the pilot; $39.99 a month after, everything included." },
        publisher: { "@id": `${url}/#org` },
      },
    ],
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Landing />
    </>
  );
}
