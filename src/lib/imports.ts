import type { CurrentUser } from "./auth";
import { HttpError, str } from "./api";
import { parseCsv } from "./csv";
import { db } from "./db";
import { IMPORT_PROVIDERS, type Field, type ImportProvider, type ImportSummary, type Reject } from "./import-types";
import { zonedParts, zonedTimeToUtc } from "./time";
import { cleanCode, parseDollars, slugify } from "./util";

export { IMPORT_PROVIDERS, isImportProvider, type ImportProvider, type ImportSummary } from "./import-types";

/**
 * Orders uploaded from the platform a venue sells on. Monitr sees the click;
 * the platform saw the sale. Its export closes the loop: each order is matched
 * to the promo code or tracking link that earned it, or counted as
 * "platform / unattributed" so the brief still sees the whole funnel.
 *
 * Money rules (CLAUDE.md): integer cents through parseDollars, never floats.
 * An imported order is revenue only when the platform actually took the money
 * (paidAt): a refunded or cancelled order is $0 and 0 tickets, a partially
 * refunded one is netted, an unpaid / pending one is a hold. Re-uploading a
 * newer export updates the same rows — the (venue, provider, externalId) index
 * decides, so nothing is ever counted twice — and a refund never comes back.
 *
 * Attendance as a platform reports it is counted in the preview but never
 * written as a door check-in: the door is Monitr's own measurement.
 *
 * Column names come from the platforms' exports as documented; the alias
 * table is tolerant, and the dry-run preview names every column it could not
 * find, so a pilot's real file is checked before anything is written.
 */

/** Header aliases, compared after lower-casing and stripping everything but letters and digits. */
const ALIASES: Record<Field, string[]> = {
  id: ["orderid", "order", "orderno", "ordernumber", "confirmationnumber", "confirmation", "reservationid", "confirmationcode", "id", "orderreference", "reference"],
  date: ["orderdate", "date", "orderedat", "created", "createdat", "purchasedate", "purchasedat", "reservationdate", "datetime", "timestamp", "ordertimestamp", "booked", "bookedat"],
  time: ["ordertime", "time", "reservationtime"],
  name: ["name", "guestname", "buyername", "customername", "attendeename", "fullname", "guest", "customer", "attendee"],
  firstName: ["firstname", "first", "buyerfirstname", "guestfirstname"],
  lastName: ["lastname", "last", "surname", "buyerlastname", "guestlastname"],
  email: ["email", "emailaddress", "buyeremail", "guestemail", "attendeeemail", "customeremail"],
  quantity: ["quantity", "qty", "tickets", "ticketquantity", "ticketcount", "numberoftickets", "partysize", "covers", "party", "guests", "seats"],
  total: ["totalpaid", "total", "ordertotal", "amountpaid", "paid", "grosssales", "subtotal", "ticketrevenue", "revenue", "amount", "netsales", "nettotal", "totalrevenue"],
  status: ["orderstatus", "status", "attendeestatus", "reservationstatus", "state", "paymentstatus"],
  promo: ["promocode", "promo", "discountcode", "code", "coupon", "couponcode", "accesscode", "discount", "promotioncode"],
  tracking: ["affiliate", "trackinglink", "tracking", "trackinglinkname", "promoter", "referrer", "referral", "source", "channel", "sourcename", "trackingcode", "affiliatecode", "utmsource"],
  campaign: ["campaign", "campaignname", "utmcampaign"],
  eventName: ["eventname", "event", "eventtitle", "show"],
  eventId: ["eventid", "eventnumber"],
  eventDate: ["eventdate", "eventstart", "eventstartdate", "startdate", "eventdatetime", "showdate"],
  eventTime: ["eventtime", "eventstarttime", "starttime"],
  checkedIn: ["checkedin", "checkin", "attended", "arrived", "seated", "checkedinstatus", "attendance", "checkinstatus"],
};
const REQUIRED: Field[] = ["id", "date"];

const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");

export function findColumns(headers: string[]): Partial<Record<Field, number>> {
  const normed = headers.map(norm);
  const cols: Partial<Record<Field, number>> = {};
  for (const field of Object.keys(ALIASES) as Field[]) {
    for (const alias of ALIASES[field]) {
      const i = normed.indexOf(alias);
      if (i >= 0) {
        cols[field] = i;
        break;
      }
    }
  }
  return cols;
}

export type ImportRow = {
  line: number;
  externalId: string;
  orderedAt: Date;
  guestName: string;
  guestEmail: string;
  quantity: number;
  /** net of refunds, before the platform's fees; 0 when refunded, cancelled or free */
  amountCents: number;
  /** the platform has the money: counted as revenue at orderedAt */
  paid: boolean;
  /** fully refunded or cancelled: no money, no tickets */
  refunded: boolean;
  /** ordered but not paid (pending, abandoned, invoice): a hold, never revenue */
  unpaid: boolean;
  promoCode: string;
  tracking: string;
  eventName: string;
  eventExternalId: string;
  eventStartsAt: Date | null;
  /** attendance as the platform reports it — shown in the preview only, never written as a check-in */
  attended: boolean | null;
};
export type Parsed = { headers: string[]; missing: Field[]; rows: ImportRow[]; rejects: Reject[] };

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };

/**
 * A platform's date cell, read as wall-clock time in the venue's zone unless it
 * carries its own zone ("Z", "±hh:mm", "UTC", "GMT"). Accepts "2026-09-26 19:05",
 * "9/26/2026 7:05 PM", "Sep 26, 2026 7:05pm", "26 Sep 2026", ISO. Month/day
 * order follows the US convention of the platforms' exports. Null if unreadable
 * or if it carries a zone the reader cannot apply — a guess that lands an order
 * in the wrong week is worse than a skipped line.
 */
export function parseWhen(dateCell: string, timeCell: string, tz: string): Date | null {
  const text = `${dateCell} ${timeCell}`.trim();
  if (!text) return null;
  if (/\d{4}-\d{2}-\d{2}/.test(text) && /(Z|[+-]\d{2}:\d{2})$/.test(text.replace(/\s+/g, ""))) {
    const d = new Date(text.replace(" ", "T"));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  let y = 0, m = 0, d = 0;
  let rest = "";
  let r: RegExpExecArray | null;
  if ((r = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](.*))?$/.exec(text))) [y, m, d, rest] = [+r[1], +r[2], +r[3], r[4] ?? ""];
  else if ((r = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ ,]+(.*))?$/.exec(text))) [m, d, y, rest] = [+r[1], +r[2], +r[3], r[4] ?? ""];
  else if ((r = /^([A-Za-z]{3,9})\.? (\d{1,2}),? (\d{4})(?:[ ,]+(.*))?$/.exec(text))) [m, d, y, rest] = [MONTHS[r[1].slice(0, 4).toLowerCase()] ?? MONTHS[r[1].slice(0, 3).toLowerCase()] ?? 0, +r[2], +r[3], r[4] ?? ""];
  else if ((r = /^(\d{1,2}) ([A-Za-z]{3,9})\.? (\d{4})(?:[ ,]+(.*))?$/.exec(text))) [d, m, y, rest] = [+r[1], MONTHS[r[2].slice(0, 3).toLowerCase()] ?? 0, +r[3], r[4] ?? ""];
  else return null;
  if (!m || !d || y < 2000 || y > 2100) return null;
  let h = 0, min = 0;
  let tail = rest.trim();
  const t = /^(\d{1,2})(?::(\d{2}))?(?::\d{2})?\s*([AaPp][Mm]?)?/.exec(tail);
  if (t) {
    h = +t[1];
    min = +(t[2] ?? 0);
    const ap = t[3]?.toLowerCase();
    if (ap?.startsWith("p") && h < 12) h += 12;
    if (ap?.startsWith("a") && h === 12) h = 0;
    tail = tail.slice(t[0].length).trim();
  }
  if (h > 23 || min > 59) return null;
  // Whatever follows the time must be a zone the reader understands, or nothing.
  const utc = /^(utc|gmt|z)$/i.test(tail);
  if (tail && !utc) return null;
  const when = utc ? new Date(Date.UTC(y, m - 1, d, h, min)) : zonedTimeToUtc(y, m, d, h, min, tz);
  if (Number.isNaN(when.getTime())) return null;
  // Feb 31 must not quietly become Mar 3.
  const back = utc ? { y: when.getUTCFullYear(), m: when.getUTCMonth() + 1, d: when.getUTCDate() } : zonedParts(when, tz);
  return back.y === y && back.m === m && back.d === d ? when : null;
}

const FREE = /^(free|comp|complimentary|n\/?a|none|—|-|–)$/i;
const FOREIGN = /[£€¥]|\b(EUR|GBP|CAD|AUD|MXN|JPY|CHF)\b/i;

/** "$1,204.50" → 120450; "(12.00)" or "-12.00" → -1200; "" or "Free" → 0; another currency or unreadable → null. */
export function parseMoneyCell(cell: string): number | null {
  const text = cell.trim();
  if (!text || FREE.test(text)) return 0;
  if (FOREIGN.test(text)) return null; // only US dollars are read as dollars
  if (!/\d/.test(text)) return null;
  // "$", "USD" and spaces around the number are noise; letters inside it are not.
  let s = text.replace(/^[A-Za-z$\s]+|[A-Za-z$\s]+$/g, "");
  let sign = 1;
  if (/^\(.*\)$/.test(s)) {
    sign = -1;
    s = s.slice(1, -1);
  }
  if (s.startsWith("-")) {
    sign = -1;
    s = s.slice(1);
  }
  const cents = parseDollars(s);
  return cents === null ? null : sign * cents;
}

/** "2", "2 tickets", "4 guests" → 2, 2, 4; anything else → null. */
export function parseQuantity(cell: string): number | null {
  const s = cell.trim().replace(/\s*(tickets?|guests?|people|pax|seats?|covers?)$/i, "");
  if (!/^\d{1,3}$/.test(s)) return null;
  const n = Number(s);
  return n >= 1 && n <= 500 ? n : null;
}

const PARTIAL = /partial/;
const REFUNDED = /refund|cancel|void|notattending|declined|chargeback|noshow|deleted|transferred/;
const UNPAID = /unpaid|pending|abandoned|started|awaiting|unconfirmed|incomplete|invoice/;
const YES = /^(yes|y|true|1|checkedin|checked|attended|arrived|seated|present)$/;
const NO = /^(no|n|false|0|notcheckedin|absent|noshow|cancelled|canceled|pending)$/;

/** Reads a platform export. Nothing is written; the caller decides what to do with rows and rejects. */
export function parseExport(csvText: string, provider: ImportProvider, tz: string): Parsed {
  const table = parseCsv(csvText);
  if (!table.length) return { headers: [], missing: REQUIRED, rows: [], rejects: [] };
  const headers = table[0].map((h) => h.trim());
  const cols = findColumns(headers);
  const missing = REQUIRED.filter((f) => cols[f] === undefined);
  const rows: ImportRow[] = [];
  const rejects: Reject[] = [];
  if (missing.length) return { headers, missing, rows, rejects };

  const cell = (r: string[], f: Field) => (cols[f] === undefined ? "" : str(r[cols[f]!] ?? "", 300));
  const seen = new Map<string, number>();
  for (let i = 1; i < table.length; i++) {
    const r = table[i];
    const line = i + 1;
    const externalId = cell(r, "id");
    if (!externalId) {
      rejects.push({ line, reason: "no order id" });
      continue;
    }
    const whenText = `${cell(r, "date")} ${cell(r, "time")}`.trim();
    const orderedAt = parseWhen(cell(r, "date"), cell(r, "time"), tz);
    if (!orderedAt) {
      rejects.push({ line, reason: `unreadable date "${whenText}"` });
      continue;
    }
    const money = parseMoneyCell(cell(r, "total"));
    if (money === null) {
      rejects.push({ line, reason: `unreadable amount "${cell(r, "total")}" (US dollars only)` });
      continue;
    }
    const qtyCell = cell(r, "quantity");
    const quantity = qtyCell ? parseQuantity(qtyCell) : 1;
    if (quantity === null) {
      rejects.push({ line, reason: `unreadable quantity "${qtyCell}"` });
      continue;
    }
    const status = norm(cell(r, "status"));
    const partial = PARTIAL.test(status);
    const refunded = !partial && (money < 0 || REFUNDED.test(status));
    const unpaid = !refunded && UNPAID.test(status);
    const guestName = cell(r, "name") || `${cell(r, "firstName")} ${cell(r, "lastName")}`.trim() || cell(r, "email").split("@")[0] || "Guest";
    const checkCell = norm(cell(r, "checkedIn"));
    const attended = cols.checkedIn === undefined ? null : YES.test(checkCell) ? true : NO.test(checkCell) || checkCell === "" ? false : null;
    const eventName = cell(r, "eventName");
    const eventStartsAt = cell(r, "eventDate") ? parseWhen(cell(r, "eventDate"), cell(r, "eventTime"), tz) : null;
    // The platform's event id, else the name plus the parsed start, so "Oct 3, 2026 9:00 PM" and "2026-10-03 21:00" are one night.
    const eventExternalId = cell(r, "eventId") || (eventName ? `${slugify(eventName, 40)}${eventStartsAt ? `-${eventStartsAt.toISOString().slice(0, 16)}` : ""}` : "");
    const row: ImportRow = {
      line, externalId, orderedAt,
      guestName: guestName.slice(0, 120),
      guestEmail: cell(r, "email").toLowerCase().slice(0, 200),
      quantity,
      amountCents: money,
      paid: false,
      refunded,
      unpaid,
      promoCode: cleanCode(cell(r, "promo")),
      tracking: cell(r, "tracking") || cell(r, "campaign"),
      eventName: eventName.slice(0, 120),
      eventExternalId: eventExternalId.slice(0, 120),
      eventStartsAt,
      attended,
    };
    // The same order on two lines (a refund after the sale): a full refund sticks whatever the order;
    // a partial refund is netted against the sale and keeps its tickets.
    const prior = seen.get(externalId);
    if (prior !== undefined) {
      const p = rows[prior];
      const fullyRefunded = p.refunded || row.refunded;
      rows[prior] = {
        ...row,
        refunded: fullyRefunded,
        unpaid: !fullyRefunded && row.unpaid,
        amountCents: fullyRefunded ? 0 : p.amountCents + row.amountCents,
        quantity: fullyRefunded ? 0 : partial || row.amountCents < 0 ? p.quantity : row.quantity,
        attended: row.attended ?? p.attended,
      };
    } else {
      seen.set(externalId, rows.length);
      rows.push(row);
    }
  }
  for (const row of rows) {
    if (row.refunded) {
      row.amountCents = 0;
      row.quantity = 0;
    } else row.amountCents = Math.max(0, row.amountCents);
    row.paid = !row.refunded && !row.unpaid && row.amountCents > 0;
  }
  return { headers, missing, rows, rejects };
}

type ChannelKey = { id: string; code: string; slug: string; name: string };

/** The channel an order belongs to: its promo code first, else the tracking link / affiliate / source name. */
export function attribute(row: Pick<ImportRow, "promoCode" | "tracking">, channels: ChannelKey[]): ChannelKey | null {
  if (row.promoCode) {
    const byCode = channels.find((c) => c.code === row.promoCode);
    if (byCode) return byCode;
  }
  const t = row.tracking.trim();
  if (!t) return null;
  const tn = norm(t);
  return channels.find((c) => c.slug === t || norm(c.slug) === tn || norm(c.name) === tn || c.code === cleanCode(t)) ?? null;
}

const MAX_CSV_CHARS = 2_000_000;
/** Rows per upload: a month of a busy venue is a few hundred; a year of history goes in by month. */
const MAX_ROWS = 5_000;
const MAX_ID = 120;
const TOO_BIG = "That file is too large — export one month at a time.";

/** An imported row that a previous upload already refunded: it stays refunded whatever an older file says. */
const isRefundedRow = (b: { amountCents: number; partySize: number; paidAt: Date | null }) => b.amountCents === 0 && b.partySize === 0 && !b.paidAt;

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];
type Planned = { row: ImportRow; channel: ChannelKey | null };

/** What this file would do against what is already stored, and the preview's figures. */
function summarise(provider: ImportProvider, parsed: Parsed, planned: Planned[], existing: Map<string, { amountCents: number; partySize: number; paidAt: Date | null }>): ImportSummary {
  const keepsRefund = (p: Planned) => {
    const was = existing.get(p.row.externalId);
    return !!was && isRefundedRow(was) && !p.row.refunded;
  };
  const byChannel = new Map<string, { name: string; orders: number; revenueCents: number }>();
  let revenueCents = 0;
  for (const p of planned) {
    if (keepsRefund(p)) continue;
    if (p.row.paid) revenueCents += p.row.amountCents;
    if (p.channel) {
      const c = byChannel.get(p.channel.id) ?? { name: p.channel.name, orders: 0, revenueCents: 0 };
      c.orders++;
      if (p.row.paid) c.revenueCents += p.row.amountCents;
      byChannel.set(p.channel.id, c);
    }
  }
  return {
    provider,
    rows: parsed.rows.length,
    created: planned.filter((p) => !existing.has(p.row.externalId)).length,
    updated: planned.filter((p) => existing.has(p.row.externalId) && !keepsRefund(p)).length,
    keptRefunded: planned.filter(keepsRefund).length,
    rejected: parsed.rejects.length,
    attributed: planned.filter((p) => p.channel).length,
    unattributed: planned.filter((p) => !p.channel).length,
    refunded: parsed.rows.filter((r) => r.refunded).length,
    unpaid: parsed.rows.filter((r) => r.unpaid).length,
    attended: parsed.rows.filter((r) => r.attended === true).length,
    revenueCents,
    missing: parsed.missing,
    headers: parsed.headers,
    rejects: parsed.rejects.slice(0, 50),
    byChannel: [...byChannel.values()].sort((a, b) => b.revenueCents - a.revenueCents),
  };
}

const readExisting = async (tx: Tx | typeof db, venueId: string, provider: ImportProvider, ids: string[]) =>
  new Map((await tx.booking.findMany({ where: { venueId, provider, externalId: { in: ids } }, select: { externalId: true, amountCents: true, partySize: true, paidAt: true } })).map((b) => [b.externalId!, b]));

/**
 * Dry run or commit. A commit takes the venue's row lock, re-reads what exists,
 * upserts every row and records the upload in one transaction: two uploads
 * for the same venue run one after the other (never deadlocked, never
 * double-counted in the history), nothing in the file can touch a native
 * booking or another venue, and a refund never comes back.
 */
export async function importOrders(user: CurrentUser, provider: ImportProvider, csvText: string, fileName: string, dryRun: boolean): Promise<ImportSummary> {
  if (user.isDemo) throw new HttpError(403, "The demo venue is read-only.");
  if (csvText.length > MAX_CSV_CHARS) throw new HttpError(413, TOO_BIG);
  const venue = user.venue;
  const parsed = parseExport(csvText, provider, venue.timezone);
  if (parsed.rows.length > MAX_ROWS) throw new HttpError(413, TOO_BIG);
  for (const r of parsed.rows) {
    if (r.externalId.length > MAX_ID) {
      parsed.rejects.push({ line: r.line, reason: "order id longer than 120 characters" });
    }
  }
  parsed.rows = parsed.rows.filter((r) => r.externalId.length <= MAX_ID);
  const channels = await db.channel.findMany({ where: { venueId: venue.id }, select: { id: true, code: true, slug: true, name: true } });
  const kind = IMPORT_PROVIDERS[provider].kind;
  const planned: Planned[] = parsed.rows.map((row) => ({ row, channel: attribute(row, channels) }));
  const ids = planned.map((p) => p.row.externalId);

  if (dryRun || parsed.missing.length || !parsed.rows.length) return summarise(provider, parsed, planned, await readExisting(db, venue.id, provider, ids));

  const now = new Date();
  return db.$transaction(
    async (tx) => {
      // One upload per venue at a time: the lock serialises concurrent uploads, so rows cannot deadlock
      // and the history records exactly what each one did.
      await tx.$queryRaw`SELECT id FROM "Venue" WHERE id = ${venue.id} FOR UPDATE`;
      const existing = await readExisting(tx, venue.id, provider, ids);
      const summary = summarise(provider, parsed, planned, existing);
      const keepsRefund = (p: Planned) => {
        const was = existing.get(p.row.externalId);
        return !!was && isRefundedRow(was) && !p.row.refunded;
      };

      // Events first, so each order can hang off its night. A night the venue already created on
      // Monitr's page (same name, same local day) is reused rather than duplicated in "Coming up".
      // The stored event id is namespaced by provider: two platforms may both number an event "123".
      const eventIds = new Map<string, string>();
      for (const key of new Set(planned.map((p) => p.row.eventExternalId).filter(Boolean))) {
        const mine = planned.filter((p) => p.row.eventExternalId === key);
        const sample = mine[0].row;
        const startsAt = sample.eventStartsAt ?? mine.reduce((a, p) => (p.row.orderedAt > a ? p.row.orderedAt : a), sample.orderedAt);
        const native = sample.eventName && sample.eventStartsAt
          ? await tx.event.findFirst({
              where: { venueId: venue.id, externalId: null, name: { equals: sample.eventName, mode: "insensitive" }, startsAt: { gte: new Date(startsAt.getTime() - 12 * 3_600_000), lt: new Date(startsAt.getTime() + 12 * 3_600_000) } },
              select: { id: true },
            })
          : null;
        if (native) {
          eventIds.set(key, native.id);
          continue;
        }
        const externalId = `${provider}:${key}`.slice(0, 160);
        const ev = await tx.event.upsert({
          where: { venueId_externalId: { venueId: venue.id, externalId } },
          create: { venueId: venue.id, externalId, name: sample.eventName || `${IMPORT_PROVIDERS[provider].label} event`, kind, capacity: 0, startsAt },
          update: { name: sample.eventName || undefined, startsAt: sample.eventStartsAt ?? undefined },
          select: { id: true },
        });
        eventIds.set(key, ev.id);
      }
      for (const p of planned) {
        if (keepsRefund(p)) continue;
        const { row, channel } = p;
        const eventId = row.eventExternalId ? (eventIds.get(row.eventExternalId) ?? null) : null;
        const date = row.eventStartsAt ?? row.orderedAt;
        // A refunded or cancelled order holds no tickets and no money; an unpaid one is a hold (no paidAt).
        const shared = {
          channelId: channel?.id ?? null, eventId, kind, guestName: row.guestName, guestEmail: row.guestEmail, partySize: row.quantity, date,
          promoCode: row.promoCode || (channel?.code ?? ""), amountCents: row.amountCents, paidAt: row.paid ? row.orderedAt : null, importedAt: now,
        };
        await tx.booking.upsert({
          where: { venueId_provider_externalId: { venueId: venue.id, provider, externalId: row.externalId } },
          create: { ...shared, venueId: venue.id, provider, externalId: row.externalId, confirmation: `${venue.slug}:${provider}:${row.externalId}`, createdAt: row.orderedAt },
          update: { ...shared, createdAt: row.orderedAt },
        });
      }
      await tx.import.create({ data: { venueId: venue.id, provider, fileName: str(fileName, 120), rows: summary.rows, created: summary.created, updated: summary.updated, rejected: summary.rejected, unattributed: summary.unattributed } });
      return summary;
    },
    { timeout: 60_000, maxWait: 10_000 },
  );
}

/** The owner's recent uploads, newest first. */
export async function recentImports(venueId: string) {
  const rows = await db.import.findMany({ where: { venueId }, orderBy: { createdAt: "desc" }, take: 10 });
  return rows.map((r) => ({ id: r.id, provider: r.provider, fileName: r.fileName, rows: r.rows, created: r.created, updated: r.updated, rejected: r.rejected, unattributed: r.unattributed, at: r.createdAt.toISOString() }));
}

/** Platforms this venue has uploaded from — a link to one of them can be measured, not just clicked. */
export async function uploadedProviders(venueId: string): Promise<Set<string>> {
  const rows = await db.import.findMany({ where: { venueId }, distinct: ["provider"], select: { provider: true } });
  return new Set(rows.map((r) => r.provider));
}
