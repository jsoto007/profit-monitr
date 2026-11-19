import type { CurrentUser } from "@/lib/auth";
import { FormError, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { isProvider, normalizeDestination, websiteHost, type Provider } from "@/lib/destinations";
import { sendEmail } from "@/lib/email";

/**
 * Owner decisions. Each one is a single conditional UPDATE whose row count
 * decides the outcome, so a double-tap or two tabs can never approve twice.
 *
 * The shared demo account is read-only on the server: its decisions live in
 * the visitor's browser for the session, exactly like the design prototype,
 * so one visitor's taps never change what the next visitor sees.
 */

export type Decision = { ok: true; changed: boolean };

const readOnly = (user: CurrentUser) => user.isDemo;

export async function approveAction(user: CurrentUser, id: string): Promise<Decision> {
  if (readOnly(user)) return { ok: true, changed: false };
  const { count } = await db.action.updateMany({
    where: { id, venueId: user.venue.id, status: "open" },
    data: { status: "approved", approvedAt: new Date() },
  });
  if (!count && !(await db.action.findFirst({ where: { id, venueId: user.venue.id }, select: { id: true } }))) throw new HttpError(404, "Action not found.");
  return { ok: true, changed: count === 1 };
}

export async function approveRecommendation(user: CurrentUser, id: string): Promise<Decision> {
  if (readOnly(user)) return { ok: true, changed: false };
  const { count } = await db.recommendation.updateMany({
    where: { id, venueId: user.venue.id, status: "open" },
    data: { status: "approved", approvedAt: new Date() },
  });
  if (!count && !(await db.recommendation.findFirst({ where: { id, venueId: user.venue.id }, select: { id: true } }))) throw new HttpError(404, "Recommendation not found.");
  return { ok: true, changed: count === 1 };
}

/**
 * "Send the email" on the agent note. This records the owner's go-ahead; no
 * message is sent to guests — there is no subscriber list or mail integration
 * behind the note yet.
 */
export async function approveAgentNote(user: CurrentUser, id: string): Promise<Decision> {
  if (readOnly(user)) return { ok: true, changed: false };
  const { count } = await db.agentNote.updateMany({
    where: { id, venueId: user.venue.id, status: "open" },
    data: { status: "sent", sentAt: new Date() },
  });
  if (!count && !(await db.agentNote.findFirst({ where: { id, venueId: user.venue.id }, select: { id: true } }))) throw new HttpError(404, "Note not found.");
  return { ok: true, changed: count === 1 };
}

/** "Book a 30-minute call": one open request per venue per fortnight; the founder follows up by email. */
export async function requestExpert(user: CurrentUser, now = new Date()): Promise<Decision> {
  if (readOnly(user)) return { ok: true, changed: false };
  const since = new Date(now.getTime() - 14 * 86_400_000);
  const changed = await db.$transaction(async (tx) => {
    // Serialise per venue so two taps cannot both pass the "none yet" check.
    await tx.$queryRaw`SELECT id FROM "Venue" WHERE id = ${user.venue.id} FOR UPDATE`;
    if (await tx.expertRequest.findFirst({ where: { venueId: user.venue.id, createdAt: { gte: since } }, select: { id: true } })) return false;
    await tx.expertRequest.create({ data: { venueId: user.venue.id } });
    return true;
  });
  if (changed) {
    const ops = process.env.OPS_EMAIL;
    if (ops) await sendEmail({ to: ops, subject: `Call requested — ${user.venue.name}`, text: `${user.name} <${user.email}> asked for a 30-minute call about ${user.venue.name} (${user.venue.city}).` });
    await sendEmail({ to: user.email, subject: "Your call request", text: `Hi ${user.name.split(" ")[0]},\n\nWe got your request for a 30-minute call about ${user.venue.name}. We'll email you to pick a time.\n\n— Profit Monitr` });
  }
  return { ok: true, changed };
}

/** Switch between the sample venue and the venue's own measurements. */
export async function setSampleData(user: CurrentUser, on: boolean): Promise<Decision> {
  if (readOnly(user)) return { ok: true, changed: false };
  const { count } = await db.venue.updateMany({ where: { id: user.venue.id, sampleData: !on }, data: { sampleData: on } });
  return { ok: true, changed: count === 1 };
}

/** Where the venue's links send people by default. The URL was validated by the caller (src/lib/destinations.ts). */
export async function setBookingPage(user: CurrentUser, bookingProvider: string, bookingUrl: string, website?: string): Promise<Decision> {
  if (readOnly(user)) return { ok: true, changed: false };
  const data = { bookingProvider, bookingUrl, ...(website === undefined ? {} : { website }) };
  const { count } = await db.venue.updateMany({ where: { id: user.venue.id, NOT: data }, data });
  return { ok: true, changed: count === 1 };
}

export type BookingChoice = Decision & { bookingProvider: Provider; bookingUrl: string; website: string; websiteVerified: boolean };

/**
 * The owner's answer to "where do guests book?": the pasted page decides the
 * provider; "Monitr's page" clears it. A page that is not a known platform is
 * the venue's own site — adopted as its website when none was given (as at
 * sign-up) — and goes live once the operator has verified it. Throws FormError.
 */
export async function chooseBookingPage(user: CurrentUser, chosen: unknown, raw: string, appHosts: string[]): Promise<BookingChoice> {
  const venue = user.venue;
  const provider: Provider = isProvider(chosen) ? chosen : "native";
  if (provider === "native") {
    const r = await setBookingPage(user, "native", "");
    return { ...r, bookingProvider: "native", bookingUrl: "", website: venue.website, websiteVerified: venue.websiteVerified };
  }
  if (!raw) throw new FormError({ bookingUrl: "Paste the page where guests book." });
  let website = venue.website;
  if (provider === "website" && !websiteHost(website)) website = websiteHost(raw);
  const n = normalizeDestination(raw, website, appHosts);
  if ("error" in n) throw new FormError({ bookingUrl: n.error });
  // A new own-site host is a new claim: verification starts over.
  const siteChanged = n.provider === "website" && websiteHost(website) !== websiteHost(venue.website);
  const r = await setBookingPage(user, n.provider, n.url, website === venue.website ? undefined : website);
  if (siteChanged && !readOnly(user)) await db.venue.updateMany({ where: { id: venue.id, websiteVerified: true }, data: { websiteVerified: false } });
  return { ...r, bookingProvider: n.provider, bookingUrl: n.url, website, websiteVerified: siteChanged ? false : venue.websiteVerified };
}

/** One link's own destination (the platform's tracking link for that promoter or campaign); empty clears it. Validated by the caller. */
export async function setChannelDestination(user: CurrentUser, id: string, destination: string): Promise<Decision> {
  if (readOnly(user)) return { ok: true, changed: false };
  const { count } = await db.channel.updateMany({ where: { id, venueId: user.venue.id, NOT: { destination } }, data: { destination } });
  if (!count && !(await db.channel.findFirst({ where: { id, venueId: user.venue.id }, select: { id: true } }))) throw new HttpError(404, "Channel not found.");
  return { ok: true, changed: count === 1 };
}
