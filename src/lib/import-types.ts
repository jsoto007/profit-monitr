/** Shapes shared by the import pipeline (server) and the upload form (client). Dependency-free. */

export type ImportProvider = "eventbrite" | "posh" | "opentable";

export const IMPORT_PROVIDERS: Record<ImportProvider, { label: string; kind: "TICKET" | "RESERVATION"; hint: string }> = {
  eventbrite: { label: "Eventbrite", kind: "TICKET", hint: "Event dashboard → Reports → Orders → Export (CSV)" },
  posh: { label: "Posh", kind: "TICKET", hint: "Event → Settings → Export Event Report (CSV)" },
  opentable: { label: "OpenTable", kind: "RESERVATION", hint: "Reports → Reservations → Export (CSV), with the Source and Campaign columns" },
};
export const IMPORT_PROVIDER_KEYS = Object.keys(IMPORT_PROVIDERS) as ImportProvider[];
export const isImportProvider = (v: unknown): v is ImportProvider => typeof v === "string" && Object.hasOwn(IMPORT_PROVIDERS, v);

export type Field = "id" | "date" | "time" | "name" | "firstName" | "lastName" | "email" | "quantity" | "total" | "status" | "promo" | "tracking" | "campaign" | "eventName" | "eventId" | "eventDate" | "eventTime" | "checkedIn";
export type Reject = { line: number; reason: string };

export type ImportSummary = {
  provider: ImportProvider;
  rows: number;
  created: number;
  updated: number;
  rejected: number;
  attributed: number;
  unattributed: number;
  refunded: number;
  /** net of refunds, before the platform's fees */
  revenueCents: number;
  /** required columns the file lacks; nothing is written while this is non-empty */
  missing: Field[];
  headers: string[];
  rejects: Reject[];
  /** which channel each attributed order went to */
  byChannel: { name: string; orders: number; revenueCents: number }[];
};

/** What a missing column is called to the owner. */
export const FIELD_LABEL: Record<Field, string> = {
  id: "order id", date: "order date", time: "order time", name: "guest name", firstName: "first name", lastName: "last name", email: "email",
  quantity: "quantity", total: "total paid", status: "status", promo: "promo code", tracking: "tracking link / affiliate / source", campaign: "campaign",
  eventName: "event name", eventId: "event id", eventDate: "event date", eventTime: "event time", checkedIn: "checked in",
};
