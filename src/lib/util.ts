/** Shared helpers used by both server and client code. Keep this file dependency-free. */

/** Money is integer cents everywhere; these two are the only plan-price constants. */
export const PRICE_CENTS = 3999;
export const PRICE = "$39.99";

export const VENUE_TYPES = ["Restaurant", "Bar & lounge", "Nightclub", "Event venue", "Other"] as const;
export const SELLS = ["Table reservations", "Event tickets"] as const;
export const PROMOS = ["Instagram", "TikTok", "Email", "Google", "Paid social", "Influencers", "Promoters"] as const;

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** URL-safe venue slug, as shown in tracked links: "The Copper Room" → "the-copper-room". */
export function slugify(s: string, max = 18): string {
  return (
    (s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, max)
      .replace(/-$/, "") || "venue"
  );
}

export function fmt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

/** Whole-dollar display of a cent amount: 4892000 → "$48,920". */
export function money(cents: number): string {
  return "$" + fmt(cents / 100);
}

/** Clamped percentage string for bar widths / heights: 0.456 → "45.6%". */
export function pct(x: number): string {
  const v = Number.isFinite(x) ? x : 0;
  return Math.max(0, Math.min(100, v * 100)).toFixed(1) + "%";
}

export function firstName(name: string): string {
  return (name || "").trim().split(/\s+/)[0] || "there";
}

/** 0 (empty) … 4: one point each for length ≥ 8, an uppercase letter, a digit, a symbol. */
export function passwordScore(p: string): number {
  if (!p) return 0;
  let s = 0;
  if (p.length >= 8) s++;
  if (/[A-Z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  return Math.max(1, s);
}

/** "4242424242424242" → "4242 4242 4242 4242" (digits only, 16 max). */
export function formatCard(v: string): string {
  return v.replace(/\D/g, "").slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ");
}

/** "1228" → "12/28". */
export function formatExpiry(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 4);
  return d.length > 2 ? d.slice(0, 2) + "/" + d.slice(2) : d;
}

export function cleanCode(v: string): string {
  return (v || "").toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 12);
}

/** Host shown in tracked links (monitr.link/<venue>/<slug>). */
export function linkHost(): string {
  return process.env.NEXT_PUBLIC_LINK_HOST || "monitr.link";
}

/** Signed delta label between two totals: (118, 100) → "+18%". Empty when there is no baseline. */
export function deltaLabel(cur: number, prev: number): string {
  if (!prev) return "";
  const d = Math.round(((cur - prev) / prev) * 100);
  return `${d >= 0 ? "+" : "−"}${Math.abs(d)}%`;
}

/**
 * "84.50" → 8450. String maths only — money never passes through a float.
 * A comma is accepted only as a thousands separator ("1,204.09"); "184,50"
 * is refused rather than read as 18,450 dollars. Returns null for anything
 * that is not a plain non-negative amount under $1M.
 */
export function parseDollars(v: unknown): number | null {
  const text = typeof v === "number" ? String(v) : typeof v === "string" ? v.trim() : "";
  const m = /^\$?\s*(\d{1,3}(?:,\d{3})+|\d{1,6})(?:\.(\d{1,2}))?$/.exec(text);
  if (!m) return null;
  const dollars = Number(m[1].replace(/,/g, ""));
  if (dollars > 999_999) return null;
  return dollars * 100 + Number((m[2] ?? "").padEnd(2, "0"));
}

/** Exact display of a cent amount, for screens where money is entered or owed: 18450 → "$184.50". */
export function moneyExact(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.trunc(cents));
  return `${sign}$${Math.floor(abs / 100).toLocaleString("en-US")}.${String(abs % 100).padStart(2, "0")}`;
}
