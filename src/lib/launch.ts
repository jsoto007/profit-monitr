import { CONTACT } from "@/data/site";

/**
 * What is still missing before the site should be shown to a venue. The
 * legal pages and the footer render nothing for an empty CONTACT field, so the
 * gap is silent unless something lists it — /api/health does, and README →
 * "Before launch" says how to fill each one.
 */
export function launchGaps(): string[] {
  const gaps: string[] = [];
  if (!CONTACT.founder) gaps.push("founder name (src/data/site.ts CONTACT.founder)");
  if (!CONTACT.email) gaps.push("contact email (CONTACT.email)");
  if (!CONTACT.callUrl) gaps.push("scheduling link (CONTACT.callUrl)");
  return gaps;
}
