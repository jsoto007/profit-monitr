/** Sign-up validation shared by the form (per step) and the API (all steps). Dependency-free. */

import type { Provider } from "./destinations";
import { EMAIL_RE, PROMOS, SELLS, VENUE_TYPES } from "./util";

export type SignupFields = {
  name: string;
  email: string;
  password: string;
  venue: string;
  vtype: string;
  city: string;
  website: string;
  sells: string[];
  promos: string[];
  /** Where guests book today; "native" = Monitr's own booking page, no URL needed. */
  bookingProvider: Provider;
  bookingUrl: string;
  agree: boolean;
};

export const EMPTY_SIGNUP: SignupFields = {
  name: "", email: "", password: "",
  venue: "", vtype: "Bar & lounge", city: "", website: "", sells: ["Table reservations", "Event tickets"], promos: [],
  bookingProvider: "native", bookingUrl: "",
  agree: false,
};

export type Errors = Partial<Record<keyof SignupFields, string>>;

export function validateAccount(f: Pick<SignupFields, "name" | "email" | "password">): Errors {
  const e: Errors = {};
  if (f.name.trim().length < 2) e.name = "Please enter your name.";
  if (!EMAIL_RE.test(f.email.trim())) e.email = "Enter a valid email.";
  if (f.password.length < 8) e.password = "Use at least 8 characters.";
  return e;
}

export function validateVenue(f: Pick<SignupFields, "venue" | "city" | "sells" | "bookingProvider" | "bookingUrl">): Errors {
  const e: Errors = {};
  if (f.venue.trim().length < 2) e.venue = "What is your venue called?";
  if (f.city.trim().length < 2) e.city = "Which city?";
  if (!f.sells.length) e.sells = "Pick at least one.";
  // The URL's allow-list check lives on the server (src/lib/destinations.ts); here only presence.
  if (f.bookingProvider !== "native" && !f.bookingUrl.trim()) e.bookingUrl = "Paste the page where guests book.";
  return e;
}

/** Step 3 is the pilot agreement: no card, nothing charged — only the consent. */
export function validateConsent(f: Pick<SignupFields, "agree">): Errors {
  const e: Errors = {};
  if (!f.agree) e.agree = "Please agree to continue.";
  return e;
}

export function validateStep(step: number, f: SignupFields): Errors {
  if (step === 1) return validateAccount(f);
  if (step === 2) return validateVenue(f);
  if (step === 3) return validateConsent(f);
  return {};
}

export const cleanList = <T extends string>(allowed: readonly T[], picked: unknown): T[] =>
  Array.isArray(picked) ? allowed.filter((x) => picked.includes(x)) : [];

export const cleanVenueType = (v: unknown): string => ((VENUE_TYPES as readonly string[]).includes(v as string) ? (v as string) : "Restaurant");
export const cleanSells = (v: unknown) => cleanList(SELLS, v);
export const cleanPromos = (v: unknown) => cleanList(PROMOS, v);
