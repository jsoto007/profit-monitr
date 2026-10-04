/**
 * Where a tracked link sends people. Monitr sits on top of the booking page a
 * venue already uses, so a link's destination is the venue's Posh, Eventbrite,
 * Resy or OpenTable page (or its own site), with Monitr's /book/<venue> page as
 * the fallback for venues that have none.
 *
 * Because a destination is any URL the owner pastes, every one is validated
 * at write time against an allow-list: https only, a known platform host or
 * the venue's own website, never this app itself. Otherwise the redirect
 * would be an open relay for phishing. Dependency-free: shared by the sign-up
 * form, the API and the redirect.
 */

export type Provider = "native" | "posh" | "eventbrite" | "resy" | "opentable" | "partiful" | "website";

export const PROVIDERS: Record<Provider, { label: string; hosts: string[]; /** has an orders/attendee export the brief can import */ orders: boolean }> = {
  native: { label: "Monitr booking page", hosts: [], orders: false },
  posh: { label: "Posh", hosts: ["posh.vip"], orders: true },
  eventbrite: { label: "Eventbrite", hosts: ["eventbrite.com", "eventbrite.ca", "eventbrite.co.uk", "eventbrite.com.au", "eventbrite.ie", "eventbrite.de", "eventbrite.fr", "eventbrite.es", "eventbrite.it", "eventbrite.nl", "eventbrite.sg"], orders: true },
  resy: { label: "Resy", hosts: ["resy.com"], orders: false },
  opentable: { label: "OpenTable", hosts: ["opentable.com", "opentable.ca", "opentable.co.uk", "opentable.com.au", "opentable.com.mx", "opentable.de", "opentable.jp"], orders: true },
  partiful: { label: "Partiful", hosts: ["partiful.com"], orders: false },
  website: { label: "Your own website", hosts: [], orders: false },
};

export const PROVIDER_KEYS = Object.keys(PROVIDERS) as Provider[];
export const isProvider = (v: unknown): v is Provider => typeof v === "string" && v in PROVIDERS;

/** Attribution fidelity of a source — what its figures can prove. */
export type Fidelity = "exact" | "platform" | "clicks";

/** `host` is `allowed` or a subdomain of it ("www.posh.vip" matches "posh.vip"; "posh.vip.evil.com" does not). */
export const hostMatches = (host: string, allowed: string) => host === allowed || host.endsWith(`.${allowed}`);

/** The venue's own site as a bare host: "thecopperroom.com", "https://www.x.com/menu" → "www.x.com". Empty when unusable. */
export function websiteHost(website: string): string {
  const raw = (website || "").trim();
  if (!raw) return "";
  try {
    const host = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).hostname.toLowerCase().replace(/\.$/, "");
    return host.includes(".") ? host : "";
  } catch {
    return "";
  }
}

/** The provider a URL belongs to by its host; "website" when it is the venue's own site; "native" for an empty destination. */
export function providerOf(url: string, venueWebsite = ""): Provider {
  if (!url) return "native";
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return "website";
  }
  for (const key of PROVIDER_KEYS) if (PROVIDERS[key].hosts.some((h) => hostMatches(host, h))) return key;
  // Not a known platform: it passed the allow-list, so it is the venue's own site.
  void venueWebsite;
  return "website";
}

export type Normalized = { url: string; provider: Provider } | { error: string };

const MAX_URL = 500;

/**
 * Validates a pasted destination against the allow-list and returns it in
 * canonical form. `appHosts` are this app's own hosts (never a valid target).
 */
export function normalizeDestination(raw: unknown, venueWebsite: string, appHosts: string[] = []): Normalized {
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text) return { url: "", provider: "native" };
  if (text.length > MAX_URL) return { error: "That link is too long." };
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`);
  } catch {
    return { error: "Enter a full web address, like https://posh.vip/e/your-event." };
  }
  if (url.protocol !== "https:") return { error: "Links must start with https://." };
  if (url.username || url.password) return { error: "Links can't carry a username or password." };
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  url.hostname = host;
  if (!host.includes(".")) return { error: "Enter a full web address, like https://posh.vip/e/your-event." };
  if (appHosts.some((h) => h && hostMatches(host, h.toLowerCase()))) return { error: "That's this app's own address — point the link at your booking page instead." };
  const own = websiteHost(venueWebsite);
  const platform = PROVIDER_KEYS.find((k) => PROVIDERS[k].hosts.some((h) => hostMatches(host, h)));
  if (platform) return { url: url.toString(), provider: platform };
  if (own && hostMatches(host, own)) return { url: url.toString(), provider: "website" };
  return { error: `Links can point at Posh, Eventbrite, Resy, OpenTable, Partiful or your own website${own ? ` (${own})` : " — add it under your venue details first"}.` };
}

/**
 * The platform's own per-source parameter, so its reports credit this channel
 * too. Eventbrite reads `aff`; the others take the tracking link the owner
 * pasted as it is.
 */
export function withTracking(url: string, channelSlug: string): string {
  try {
    const u = new URL(url);
    if (PROVIDERS.eventbrite.hosts.some((h) => hostMatches(u.hostname.toLowerCase(), h)) && !u.searchParams.has("aff")) {
      u.searchParams.set("aff", channelSlug);
    }
    return u.toString();
  } catch {
    return url;
  }
}

/** Hosts this app answers on: the request's own host (when there is one) plus the configured public origins. */
export function ownHosts(req?: Request): string[] {
  const hosts = [req?.headers.get("host") || ""];
  for (const v of [process.env.APP_URL, process.env.RENDER_EXTERNAL_URL]) {
    if (!v) continue;
    try {
      hosts.push(new URL(v).host);
    } catch {
      /* ignore a malformed origin */
    }
  }
  return hosts.map((h) => h.toLowerCase().replace(/:\d+$/, "")).filter(Boolean);
}

/** One line for the owner: what a source with this fidelity can prove. */
export function fidelityNote(f: Fidelity, provider: Provider): string {
  if (f === "exact") return "bookings and door check-ins measured on your Monitr page";
  if (f === "platform") return `bookings as ${PROVIDERS[provider].label}'s export reports them`;
  return `clicks only — bookings happen on ${PROVIDERS[provider].label}`;
}
