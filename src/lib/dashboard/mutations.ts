import type { CurrentUser } from "@/lib/auth";
import { HttpError } from "@/lib/api";
import { db } from "@/lib/db";
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

/** "Book a 30-minute session": one open request per venue per fortnight; the team follows up by email. */
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
    if (ops) await sendEmail({ to: ops, subject: `Strategist session requested — ${user.venue.name}`, text: `${user.name} <${user.email}> asked for a 30-minute session for ${user.venue.name} (${user.venue.city}).` });
    await sendEmail({ to: user.email, subject: "Your strategist session request", text: `Hi ${user.name.split(" ")[0]},\n\nWe got your request for a 30-minute session for ${user.venue.name}. A strategist will email you to pick a time.\n\n— Profit Monitr` });
  }
  return { ok: true, changed };
}

/** Switch between the sample venue and the venue's own measurements. */
export async function setSampleData(user: CurrentUser, on: boolean): Promise<Decision> {
  if (readOnly(user)) return { ok: true, changed: false };
  const { count } = await db.venue.updateMany({ where: { id: user.venue.id, sampleData: !on }, data: { sampleData: on } });
  return { ok: true, changed: count === 1 };
}
