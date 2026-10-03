import type { MetadataRoute } from "next";
import { siteUrl } from "@/data/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const url = siteUrl();
  return [
    { url, changeFrequency: "monthly", priority: 1 },
    { url: `${url}/signup`, changeFrequency: "yearly", priority: 0.8 },
    { url: `${url}/login`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
