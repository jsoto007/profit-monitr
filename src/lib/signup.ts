import { DEMO } from "@/data/sample";
import { createAccount, EmailTakenError } from "./accounts";
import { FormError, HttpError, str } from "./api";
import { db } from "./db";
import { DEFAULT_TZ, isValidTimeZone } from "./time";
import { cleanPromos, cleanSells, cleanVenueType, validateAccount, validateConsent, validateVenue, type Errors } from "./validation";

export type SignupBody = {
  name?: string; email?: string; password?: string;
  venue?: string; vtype?: string; city?: string; website?: string;
  sells?: string[]; promos?: string[];
  timezone?: string;
  agree?: boolean;
};

const EMAIL_TAKEN = "An account with this email already exists. Log in instead.";

/**
 * Accounts are free pilots: no card is collected and nothing is charged.
 * Subscription billing is not built (README → Billing), so in production
 * sign-up stays closed unless the operator has opened it with ALLOW_SIGNUPS=1.
 */
export function signupsOpen(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.ALLOW_SIGNUPS === "1";
}

/** Validates all three steps and creates the pilot account. Nothing is charged. */
export async function signup(b: SignupBody) {
  if (!signupsOpen()) throw new HttpError(503, "Sign-ups aren’t open yet. Please check back soon.");

  const f = {
    name: str(b.name, 120),
    email: str(b.email, 200).toLowerCase(),
    password: typeof b.password === "string" ? b.password.slice(0, 200) : "",
    venue: str(b.venue, 120),
    city: str(b.city, 120),
    website: str(b.website, 200),
    sells: cleanSells(b.sells),
    agree: b.agree === true,
  };
  const e: Errors = { ...validateAccount(f), ...validateVenue(f), ...validateConsent(f) };
  // The demo login's address is reserved, and the unique index below is what finally decides.
  if (!e.email && (f.email === DEMO.email || (await db.user.findUnique({ where: { email: f.email }, select: { id: true } })))) e.email = EMAIL_TAKEN;
  if (Object.keys(e).length) throw new FormError(e as Record<string, string>);

  try {
    return await createAccount({
      name: f.name,
      email: f.email,
      password: f.password,
      venue: f.venue,
      vtype: cleanVenueType(b.vtype),
      city: f.city,
      website: f.website,
      timezone: isValidTimeZone(b.timezone) ? b.timezone : DEFAULT_TZ,
      sellsReservations: f.sells.includes("Table reservations"),
      sellsTickets: f.sells.includes("Event tickets"),
      promos: cleanPromos(b.promos),
      subscriptionStatus: "pilot",
    });
  } catch (err) {
    if (err instanceof EmailTakenError) throw new FormError({ email: EMAIL_TAKEN });
    throw err;
  }
}
