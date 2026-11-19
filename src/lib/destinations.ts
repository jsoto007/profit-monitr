import { linkHost } from "./util";

/**
 * Where a tracked link sends people. Monitr sits on top of the booking page a
 * venue already uses, so a link's destination is the venue's Posh, Eventbrite,
 * Resy or OpenTable page (or its own site), with Monitr's /book/<venue> page as
 * the fallback for venues that have none.
 *
 * Because a destination is any URL the owner pastes, every one is validated
 * at write time against an allow-list: https only, no port or credentials, a
 * known platform host or the venue's own website, never a link shortener and
 * never this app itself. Otherwise the redirect would be an open relay for
 * phishing. The venue's own website is whatever the owner typed, so links to
 * it are honoured only once the operator has marked the site verified
 * (Venue.websiteVerified — README → "Verifying a venue's website"); until then
 * they fall back to Monitr's page. Dependency-free apart from util.
 */

export type Provider = "native" | "posh" | "eventbrite" | "resy" | "opentable" | "partiful" | "website";

export const PROVIDERS: Record<Provider, { label: string; hosts: string[]; /** has an orders/attendee export the brief can import */ orders: boolean }> = {
  native: { label: "Monitr booking page", hosts: [], orders: false },
  posh: { label: "Posh", hosts: ["posh.vip"], orders: true },
  eventbrite: { label: "Eventbrite", hosts: ["eventbrite.com", "eventbrite.ca", "eventbrite.co.uk", "eventbrite.com.au", "eventbrite.ie", "eventbrite.de", "eventbrite.fr", "eventbrite.es", "eventbrite.it", "eventbrite.nl", "eventbrite.sg"], orders: true },
  resy: { label: "Resy", hosts: ["resy.com"], orders: false },
  opentable: { label: "OpenTable", hosts: ["opentable.com", "opentable.ca", "opentable.co.uk", "opentable.com.au", "opentable.com.mx", "opentable.de", "opentable.jp"], orders: true },
  partiful: { label: "Partiful", hosts: ["partiful.com"], orders: false },
  website: { label: "your own site", hosts: [], orders: false },
};

export const PROVIDER_KEYS = Object.keys(PROVIDERS) as Provider[];
export const isProvider = (v: unknown): v is Provider => typeof v === "string" && Object.hasOwn(PROVIDERS, v);

/** Link shorteners and shared link-in-bio hosts: a destination must be the page itself. */
const SHORTENERS = ["bit.ly", "tinyurl.com", "t.co", "goo.gl", "is.gd", "buff.ly", "ow.ly", "rebrand.ly", "cutt.ly", "linktr.ee", "lnk.bio", "beacons.ai", "tiny.cc", "short.io", "bl.ink", "rb.gy", "shorturl.at", "s.id", "t.ly", "trib.al", "lnkd.in", "youtu.be", "fb.me", "amzn.to", "dub.sh", "dub.co", "snip.ly", "zpr.io", "surl.li", "v.gd", "u.to", "x.co", "clck.ru", "tr.ee", "linkin.bio", "hoo.be", "campsite.bio", "solo.to", "bio.link", "carrd.co"];

/** Attribution fidelity of a source — what its figures can prove. */
export type Fidelity = "exact" | "platform" | "clicks";

/** `host` is `allowed` or a subdomain of it ("www.posh.vip" matches "posh.vip"; "posh.vip.evil.com" does not). */
export const hostMatches = (host: string, allowed: string) => host === allowed || host.endsWith(`.${allowed}`);
/** "www.x.com" and "x.com" are the same site. */
const bare = (host: string) => host.replace(/^www\./, "");

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

const platformOf = (host: string): Provider | null => PROVIDER_KEYS.find((k) => PROVIDERS[k].hosts.some((h) => hostMatches(host, h))) ?? null;

/** The provider a URL belongs to by its host; "website" when it is not a known platform; "native" for an empty destination. */
export function providerOf(url: string): Provider {
  if (!url) return "native";
  try {
    return platformOf(new URL(url).hostname.toLowerCase()) ?? "website";
  } catch {
    return "website";
  }
}

export type Normalized = { url: string; provider: Provider } | { error: string };

const MAX_URL = 500;
const EXAMPLE = "Enter a full web address, like https://posh.vip/e/your-event.";

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
    return { error: EXAMPLE };
  }
  if (url.protocol !== "https:") return { error: "Links must start with https://." };
  if (url.username || url.password) return { error: "Links can't carry a username or password." };
  if (url.port) return { error: "Links can't carry a port number." };
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  url.hostname = host;
  if (!host.includes(".")) return { error: EXAMPLE };
  if (appHosts.some((h) => h && hostMatches(host, h.toLowerCase()))) return { error: "That's this app's own address — point the link at your booking page instead." };
  if (SHORTENERS.some((h) => hostMatches(host, h))) return { error: "Shortened links can't be a destination — paste the page itself." };
  const platform = platformOf(host);
  if (platform) return { url: url.toString(), provider: platform };
  const own = websiteHost(venueWebsite);
  if (own && hostMatches(bare(host), bare(own))) return { url: url.toString(), provider: "website" };
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

/**
 * Hosts this app answers on: the request's own host (when there is one), the
 * configured public origin, Render's own URL and the short-link host.
 */
export function ownHosts(req?: Request): string[] {
  const hosts = [req?.headers.get("host") || "", linkHost()];
  for (const v of [process.env.APP_URL, process.env.RENDER_EXTERNAL_URL]) {
    if (!v) continue;
    try {
      hosts.push(new URL(v).host);
    } catch {
      /* ignore a malformed origin */
    }
  }
  return [...new Set(hosts.map((h) => h.toLowerCase().replace(/:\d+$/, "")).filter(Boolean))];
}

/** A link to the venue's own site is live only once the site has been verified; a platform link always is. */
export const destinationLive = (url: string, websiteVerified: boolean) => !!url && (providerOf(url) !== "website" || websiteVerified);

/** One line for the owner: what a source with this fidelity can prove. */
export function fidelityNote(f: Fidelity, provider: Provider): string {
  if (f === "exact") return "bookings and door check-ins measured on your Monitr page";
  if (f === "platform") return `bookings as ${PROVIDERS[provider].label}'s export reports them`;
  return `clicks only — bookings happen on ${PROVIDERS[provider].label}`;
}
