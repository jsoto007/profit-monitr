import { ACTIONS, ACTIONS_WEEK, AGENT_NOTE, DEMO, PAST_ACTIONS, PAST_WEEK, RECS } from "@/data/sample";
import { db, isUniqueViolation } from "./db";
import { hashPassword } from "./password";
import { DEFAULT_TZ } from "./time";
import { slugify } from "./util";

export type NewAccount = {
  name: string;
  email: string;
  password: string;
  venue: string;
  vtype: string;
  city: string;
  website: string;
  timezone?: string;
  sellsReservations: boolean;
  sellsTickets: boolean;
  promos: string[];
  cardLast4: string;
  subscriptionStatus: string;
  isDemo?: boolean;
};

/** One tracked link + code per place the venue already promotes. Instagram is always first. */
const PROMO_CHANNELS: Record<string, { name: string; detail: string; slug: string; code: string }> = {
  Instagram: { name: "Instagram", detail: "Instagram · bio link", slug: "ig", code: "INSTA" },
  TikTok: { name: "TikTok", detail: "TikTok · bio link", slug: "tiktok", code: "TIKTOK" },
  Email: { name: "Email", detail: "Newsletter", slug: "email", code: "EMAIL" },
  Google: { name: "Google search", detail: "Business profile", slug: "google", code: "GOOGLE" },
  "Paid social": { name: "Paid social", detail: "Paid campaign", slug: "paid", code: "PAID" },
  Influencers: { name: "Influencers", detail: "Influencer code", slug: "influencers", code: "VIP" },
  Promoters: { name: "Promoters", detail: "Promoter code", slug: "promoters", code: "CREW" },
};

export function defaultChannels(promos: string[]) {
  const picked = ["Instagram", ...promos.filter((p) => p !== "Instagram" && PROMO_CHANNELS[p])];
  return picked.map((p) => ({ ...PROMO_CHANNELS[p], short: PROMO_CHANNELS[p].name }));
}

/** The sample venue's workflow rows — what a new owner can approve while exploring. */
function sampleWorkflow() {
  const week = new Date(`${ACTIONS_WEEK}T00:00:00Z`);
  const past = new Date(`${PAST_WEEK}T00:00:00Z`);
  return {
    actions: {
      create: [
        ...ACTIONS.map((a, i) => ({ sample: true, weekStart: week, rank: i + 1, ...a })),
        ...PAST_ACTIONS.map((a, i) => ({ sample: true, weekStart: past, rank: i + 1, title: a.title, description: "", status: a.status, result: a.result })),
      ],
    },
    recommendations: { create: RECS.map((r, i) => ({ sample: true, rank: i + 1, ...r })) },
    agentNotes: { create: [{ sample: true, body: AGENT_NOTE }] },
  };
}

export class EmailTakenError extends Error {
  constructor() {
    super("An account with this email already exists.");
  }
}

/**
 * Creates the user, venue, its tracked links and the sample workflow in one
 * statement. Slug collisions are settled by the unique index (never
 * check-then-insert): on conflict the next "-2", "-3" … candidate is tried.
 */
export async function createAccount(a: NewAccount) {
  const email = a.email.trim().toLowerCase();
  const passwordHash = await hashPassword(a.password);
  const base = slugify(a.venue);
  for (let attempt = 1; attempt <= 25; attempt++) {
    const slug = attempt === 1 ? base : `${base}-${attempt}`;
    try {
      return await db.user.create({
        data: {
          name: a.name.trim(),
          email,
          passwordHash,
          isDemo: !!a.isDemo,
          venue: {
            create: {
              name: a.venue.trim(),
              slug,
              type: a.vtype,
              city: a.city.trim(),
              website: a.website.trim(),
              timezone: a.timezone || DEFAULT_TZ,
              sellsReservations: a.sellsReservations,
              sellsTickets: a.sellsTickets,
              promoChannels: a.promos,
              cardLast4: a.cardLast4,
              subscriptionStatus: a.subscriptionStatus,
              channels: { create: defaultChannels(a.promos) },
              ...sampleWorkflow(),
            },
          },
        },
        include: { venue: true },
      });
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
      if (await db.user.findUnique({ where: { email }, select: { id: true } })) throw new EmailTakenError();
      // otherwise the slug was taken — try the next candidate
    }
  }
  throw new Error("Could not allocate a venue slug.");
}

/** The shared public demo login. Idempotent — safe to run on every deploy. */
export async function ensureDemoAccount() {
  const existing = await db.user.findUnique({ where: { email: DEMO.email }, include: { venue: true } });
  if (existing?.isDemo && existing.venue) return existing;
  // Anything else on the demo address is not the demo (sign-up refuses that address; this is the backstop).
  if (existing) await db.user.delete({ where: { id: existing.id } });
  try {
    return await createAccount({
      name: DEMO.name,
      email: DEMO.email,
      password: DEMO.password,
      venue: DEMO.venue,
      vtype: DEMO.type,
      city: DEMO.city,
      website: DEMO.website,
      timezone: DEMO.timezone,
      sellsReservations: true,
      sellsTickets: true,
      promos: ["Instagram", "TikTok", "Email", "Influencers"],
      cardLast4: "4242",
      subscriptionStatus: "demo",
      isDemo: true,
    });
  } catch (e) {
    // Two cold starts raced; the other one won.
    if (e instanceof EmailTakenError) {
      const u = await db.user.findUnique({ where: { email: DEMO.email }, include: { venue: true } });
      if (u?.isDemo && u.venue) return u;
    }
    throw e;
  }
}
