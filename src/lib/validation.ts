/** Sign-up validation shared by the form (per step) and the API (all steps). Dependency-free. */

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
  cardName: string;
  card: string;
  exp: string;
  cvc: string;
  zip: string;
  agree: boolean;
};

export const EMPTY_SIGNUP: SignupFields = {
  name: "", email: "", password: "",
  venue: "", vtype: "Restaurant", city: "", website: "", sells: ["Table reservations"], promos: [],
  cardName: "", card: "", exp: "", cvc: "", zip: "", agree: false,
};

export type Errors = Partial<Record<keyof SignupFields, string>>;

export function validateAccount(f: Pick<SignupFields, "name" | "email" | "password">): Errors {
  const e: Errors = {};
  if (f.name.trim().length < 2) e.name = "Please enter your name.";
  if (!EMAIL_RE.test(f.email.trim())) e.email = "Enter a valid email.";
  if (f.password.length < 8) e.password = "Use at least 8 characters.";
  return e;
}

export function validateVenue(f: Pick<SignupFields, "venue" | "city" | "sells">): Errors {
  const e: Errors = {};
  if (f.venue.trim().length < 2) e.venue = "What is your venue called?";
  if (f.city.trim().length < 2) e.city = "Which city?";
  if (!f.sells.length) e.sells = "Pick at least one.";
  return e;
}

/**
 * Card fields are checked in the browser only — the number, expiry and CVC
 * never leave it. `withCard` is false when a hosted payment form collects them.
 */
export function validateBilling(f: Pick<SignupFields, "cardName" | "card" | "exp" | "cvc" | "zip" | "agree">, withCard = true): Errors {
  const e: Errors = {};
  if (withCard) {
    if (f.cardName.trim().length < 2) e.cardName = "Name as it appears on the card.";
    if (f.card.replace(/\D/g, "").length !== 16) e.card = "Enter a 16-digit card number.";
    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(f.exp)) e.exp = "MM/YY";
    if (!/^\d{3,4}$/.test(f.cvc)) e.cvc = "3–4 digits";
    if (f.zip.trim().length < 3) e.zip = "Required";
  }
  if (!f.agree) e.agree = "Please agree to continue.";
  return e;
}

export function validateStep(step: number, f: SignupFields, withCard = true): Errors {
  if (step === 1) return validateAccount(f);
  if (step === 2) return validateVenue(f);
  if (step === 3) return validateBilling(f, withCard);
  return {};
}

export const cleanList = <T extends string>(allowed: readonly T[], picked: unknown): T[] =>
  Array.isArray(picked) ? allowed.filter((x) => picked.includes(x)) : [];

export const cleanVenueType = (v: unknown): string => ((VENUE_TYPES as readonly string[]).includes(v as string) ? (v as string) : "Restaurant");
export const cleanSells = (v: unknown) => cleanList(SELLS, v);
export const cleanPromos = (v: unknown) => cleanList(PROMOS, v);
