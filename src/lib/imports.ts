import type { CurrentUser } from "./auth";
import { HttpError, str } from "./api";
import { parseCsv } from "./csv";
import { db } from "./db";
import { zonedParts, zonedTimeToUtc } from "./time";
import { cleanCode, parseDollars, slugify } from "./util";

/**
 * Orders uploaded from the platform a venue sells on. Monitr sees the click;
 * the platform saw the sale. Its export closes the loop: each order is matched
 * to the promo code or tracking link that earned it, or counted as
 * "platform / unattributed" so the brief still sees the whole funnel.
 *
 * Money rules (CLAUDE.md): integer cents through parseDollars, never floats.
 * An imported paid order is revenue when the platform took the money (paidAt);
 * a refunded or cancelled order is $0. Re-uploading a newer export updates the
 * same rows — the (venue, provider, externalId) index decides, so nothing is
 * ever counted twice.
 *
 * Column names come from the platforms' exports as documented and seen; the
 * alias table below is tolerant, and the dry-run preview names every column it
 * could not find, so a pilot's real file is checked before anything is written.
 */

import { IMPORT_PROVIDERS, type Field, type ImportProvider, type ImportSummary, type Reject } from "./import-types";

export { IMPORT_PROVIDERS, isImportProvider, type ImportProvider, type ImportSummary } from "./import-types";

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
  // "Source" on OpenTable is the marketing source; on a generic export it may be the tracking name. Both map to tracking.
  return cols;
}

export type ImportRow = {
  line: number;
  externalId: string;
  orderedAt: Date;
  guestName: string;
  guestEmail: string;
  quantity: number;
  /** net of refunds, before the platform's fees; 0 for refunded, cancelled or free */
  amountCents: number;
  refunded: boolean;
  promoCode: string;
  tracking: string;
  eventName: string;
  eventExternalId: string;
  eventStartsAt: Date | null;
  checkedIn: boolean | null;
};
export type Parsed = { headers: string[]; missing: Field[]; rows: ImportRow[]; rejects: Reject[] };

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };

/**
 * A platform's date cell, read as wall-clock time in the venue's zone unless it
 * carries its own offset. Accepts "2026-09-26 19:05", "9/26/2026 7:05 PM",
 * "Sep 26, 2026 7:05pm", "26 Sep 2026", ISO with Z or ±hh:mm. Null if unreadable.
 */
export function parseWhen(dateCell: string, timeCell: string, tz: string): Date | null {
  const text = `${dateCell} ${timeCell}`.trim();
  if (!text) return null;
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(text.replace(/\s+/g, "")) && /\d{4}-\d{2}-\d{2}/.test(text)) {
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
  const t = /^(\d{1,2})(?::(\d{2}))?(?::\d{2})?\s*([AaPp][Mm]?)?/.exec(rest.trim());
  if (t) {
    h = +t[1];
    min = +(t[2] ?? 0);
    const ap = t[3]?.toLowerCase();
    if (ap?.startsWith("p") && h < 12) h += 12;
    if (ap?.startsWith("a") && h === 12) h = 0;
  }
  if (h > 23 || min > 59) return null;
  const when = zonedTimeToUtc(y, m, d, h, min, tz);
  if (Number.isNaN(when.getTime())) return null;
  // Feb 31 must not quietly become Mar 3.
  const back = zonedParts(when, tz);
  return back.y === y && back.m === m && back.d === d ? when : null;
}

/** "$1,204.50" → 120450; "(12.00)" or "-12.00" → -1200; "" → 0; unreadable → null. */
export function parseMoneyCell(cell: string): number | null {
  if (!cell.trim()) return 0;
  if (!/\d/.test(cell)) return null;
  // Currency symbols and codes around the number ("USD 30.00", "$1,204.50", "30.00 EUR") are noise; letters inside it are not.
  let s = cell.trim().replace(/^[A-Za-z$€£\s]+|[A-Za-z$€£\s]+$/g, "");
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

const REFUNDED = /refund|cancel|void|notattending|declined|chargeback|noshow|no-show|deleted|transferred/;
const YES = /^(yes|y|true|1|checkedin|checked|attended|arrived|seated|complete|completed|present)$/;
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
      rejects.push({ line, reason: `unreadable amount "${cell(r, "total")}"` });
      continue;
    }
    const qtyCell = cell(r, "quantity");
    const quantity = qtyCell ? Number(qtyCell.replace(/[^\d]/g, "")) : 1;
    if (!(quantity >= 1 && quantity <= 500) || !Number.isInteger(quantity)) {
      rejects.push({ line, reason: `unreadable quantity "${qtyCell}"` });
      continue;
    }
    const status = norm(cell(r, "status"));
    const refunded = money < 0 || REFUNDED.test(status);
    const guestName = cell(r, "name") || `${cell(r, "firstName")} ${cell(r, "lastName")}`.trim() || cell(r, "email").split("@")[0] || "Guest";
    // Attendance: a checked-in column when the export has one; otherwise a reservation status such as "Seated" / "No-show".
    const checkCell = norm(cell(r, "checkedIn"));
    const checkedIn = cols.checkedIn !== undefined
      ? YES.test(checkCell) ? true : NO.test(checkCell) || checkCell === "" ? false : null
      : /seated|arrived|attended|checkedin|complete/.test(status) ? true : /noshow|cancel/.test(status) ? false : null;
    const eventName = cell(r, "eventName");
    const eventExternalId = cell(r, "eventId") || (eventName ? slugify(eventName, 40) + (cell(r, "eventDate") ? `-${norm(cell(r, "eventDate"))}` : "") : "");
    const eventStartsAt = cell(r, "eventDate") ? parseWhen(cell(r, "eventDate"), cell(r, "eventTime"), tz) : null;
    const row: ImportRow = {
      line,
      externalId,
      orderedAt,
      guestName: guestName.slice(0, 120),
      guestEmail: cell(r, "email").toLowerCase().slice(0, 200),
      quantity,
      amountCents: refunded ? 0 : money,
      refunded,
      promoCode: cleanCode(cell(r, "promo")),
      tracking: cell(r, "tracking") || cell(r, "campaign"),
      eventName: eventName.slice(0, 120),
      eventExternalId: eventExternalId.slice(0, 120),
      eventStartsAt,
      checkedIn,
    };
    // The same order twice in one file (a refund line after the sale): the later line wins.
    const prior = seen.get(externalId);
    if (prior !== undefined) rows[prior] = { ...row, refunded: row.refunded || rows[prior].refunded, amountCents: row.refunded || rows[prior].refunded ? 0 : row.amountCents };
    else {
      seen.set(externalId, rows.length);
      rows.push(row);
    }
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

/**
 * Dry run or commit. A commit upserts every row inside one transaction and
 * records the upload; nothing in the file can touch a native booking or
 * another venue.
 */
export async function importOrders(user: CurrentUser, provider: ImportProvider, csvText: string, fileName: string, dryRun: boolean): Promise<ImportSummary> {
  if (user.isDemo) throw new HttpError(403, "The demo venue is read-only.");
  if (csvText.length > MAX_CSV_CHARS) throw new HttpError(413, "That file is too large — export one month at a time.");
  const venue = user.venue;
  const parsed = parseExport(csvText, provider, venue.timezone);
  const channels = await db.channel.findMany({ where: { venueId: venue.id }, select: { id: true, code: true, slug: true, name: true } });
  const kind = IMPORT_PROVIDERS[provider].kind;

  const planned = parsed.rows.map((row) => ({ row, channel: attribute(row, channels) }));
  const ids = planned.map((p) => p.row.externalId);
  const existing = new Set((await db.booking.findMany({ where: { venueId: venue.id, provider, externalId: { in: ids } }, select: { externalId: true } })).map((b) => b.externalId!));
  const byChannel = new Map<string, { name: string; orders: number; revenueCents: number }>();
  let revenueCents = 0;
  for (const p of planned) {
    revenueCents += p.row.amountCents;
    if (p.channel) {
      const c = byChannel.get(p.channel.id) ?? { name: p.channel.name, orders: 0, revenueCents: 0 };
      c.orders++;
      c.revenueCents += p.row.amountCents;
      byChannel.set(p.channel.id, c);
    }
  }
  const summary: ImportSummary = {
    provider,
    rows: parsed.rows.length,
    created: planned.filter((p) => !existing.has(p.row.externalId)).length,
    updated: planned.filter((p) => existing.has(p.row.externalId)).length,
    rejected: parsed.rejects.length,
    attributed: planned.filter((p) => p.channel).length,
    unattributed: planned.filter((p) => !p.channel).length,
    refunded: parsed.rows.filter((r) => r.refunded).length,
    revenueCents,
    missing: parsed.missing,
    headers: parsed.headers,
    rejects: parsed.rejects.slice(0, 50),
    byChannel: [...byChannel.values()].sort((a, b) => b.revenueCents - a.revenueCents),
  };
  if (dryRun || parsed.missing.length || !parsed.rows.length) return summary;

  const now = new Date();
  await db.$transaction(async (tx) => {
    // Events first, so each order can hang off its night.
    const eventIds = new Map<string, string>();
    for (const key of new Set(planned.map((p) => p.row.eventExternalId).filter(Boolean))) {
      const sample = planned.find((p) => p.row.eventExternalId === key)!.row;
      const startsAt = sample.eventStartsAt ?? planned.filter((p) => p.row.eventExternalId === key).reduce((a, p) => (p.row.orderedAt > a ? p.row.orderedAt : a), sample.orderedAt);
      const ev = await tx.event.upsert({
        where: { venueId_externalId: { venueId: venue.id, externalId: key } },
        create: { venueId: venue.id, externalId: key, name: sample.eventName || `${IMPORT_PROVIDERS[provider].label} event`, kind, capacity: 0, startsAt },
        update: { name: sample.eventName || undefined, startsAt: sample.eventStartsAt ?? undefined },
        select: { id: true },
      });
      eventIds.set(key, ev.id);
    }
    for (const { row, channel } of planned) {
      const eventId = row.eventExternalId ? (eventIds.get(row.eventExternalId) ?? null) : null;
      const date = row.eventStartsAt ?? row.orderedAt;
      // Attendance as the platform reports it; its scanner stamped no time, so the night itself stands in.
      const checkedInAt = row.checkedIn === true ? date : row.checkedIn === false ? null : undefined;
      const paidAt = row.amountCents > 0 ? row.orderedAt : null;
      // A refunded or cancelled order holds no tickets and no money.
      const shared = {
        channelId: channel?.id ?? null, eventId, kind, guestName: row.guestName, guestEmail: row.guestEmail, partySize: row.refunded ? 0 : row.quantity, date,
        promoCode: row.promoCode || (channel?.code ?? ""), amountCents: row.amountCents, paidAt, importedAt: now,
      };
      await tx.booking.upsert({
        where: { venueId_provider_externalId: { venueId: venue.id, provider, externalId: row.externalId } },
        create: { ...shared, venueId: venue.id, provider, externalId: row.externalId, confirmation: `${venue.slug}:${provider}:${row.externalId}`.slice(0, 180), createdAt: row.orderedAt, checkedInAt: checkedInAt ?? null },
        update: { ...shared, createdAt: row.orderedAt, ...(checkedInAt === undefined ? {} : { checkedInAt }) },
      });
    }
    await tx.import.create({ data: { venueId: venue.id, provider, fileName: str(fileName, 120), rows: summary.rows, created: summary.created, updated: summary.updated, rejected: summary.rejected, unattributed: summary.unattributed } });
  });
  return summary;
}

/** The owner's recent uploads, newest first. */
export async function recentImports(venueId: string) {
  const rows = await db.import.findMany({ where: { venueId }, orderBy: { createdAt: "desc" }, take: 10 });
  return rows.map((r) => ({ id: r.id, provider: r.provider, fileName: r.fileName, rows: r.rows, created: r.created, updated: r.updated, rejected: r.rejected, unattributed: r.unattributed, at: r.createdAt.toISOString() }));
}
