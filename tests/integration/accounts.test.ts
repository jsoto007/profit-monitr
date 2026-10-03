import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAccount, EmailTakenError, ensureDemoAccount } from "@/lib/accounts";
import { absoluteUrl, clientKey, FormError, handler, HttpError, readJson, str } from "@/lib/api";
import { hasAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { blocked, forgive, resetRateLimits, spend } from "@/lib/rate-limit";
import { signup, signupsOpen, type SignupBody } from "@/lib/signup";
import { makeAccount, resetDb } from "../helpers";

beforeEach(resetDb);

const body = (over: Partial<SignupBody> = {}): SignupBody => ({
  name: "Dana Test", email: "dana@example.test", password: "correct horse 9!",
  venue: "Test Kitchen & Bar", vtype: "Bar & lounge", city: "Brooklyn, NY", website: "testkitchen.example",
  sells: ["Table reservations", "Event tickets"], promos: ["TikTok", "Email"], timezone: "America/New_York", agree: true,
  card: { name: "Dana Test", last4: "4242", zip: "11201" },
  ...over,
});

describe("createAccount", () => {
  it("creates the user, venue, tracked links and the sample workflow in one go", async () => {
    const user = await makeAccount({ venue: "The Copper Room", promos: ["Instagram", "TikTok", "Email"] });
    const venue = await db.venue.findUniqueOrThrow({ where: { id: user.venue.id }, include: { channels: { orderBy: { createdAt: "asc" } }, actions: true, recommendations: true, agentNotes: true } });
    expect(venue.slug).toBe("the-copper-room");
    expect(venue.sampleData).toBe(true);
    expect(venue.channels.map((c) => `${c.slug}:${c.code}`).sort()).toEqual(["email:EMAIL", "ig:INSTA", "tiktok:TIKTOK"]);
    expect(venue.actions.filter((a) => a.status === "open")).toHaveLength(3);
    expect(venue.actions.filter((a) => a.status !== "open").map((a) => a.status).sort()).toEqual(["done", "done", "skipped"]);
    expect(venue.recommendations).toHaveLength(3);
    expect(venue.agentNotes).toHaveLength(1);
    expect(await verifyPassword("correct horse 9!", user.passwordHash)).toBe(true);
    expect(user.passwordHash).not.toContain("correct horse");
  });

  it("gives a second venue with the same name the next slug", async () => {
    const a = await makeAccount({ venue: "Sunset Bar" });
    const b = await makeAccount({ venue: "Sunset Bar" });
    expect([a.venue.slug, b.venue.slug]).toEqual(["sunset-bar", "sunset-bar-2"]);
  });

  it("lets the unique index — not a prior read — settle a race for the same email", async () => {
    const one = { name: "A", email: "race@example.test", password: "password1", venue: "Race", vtype: "Restaurant", city: "NYC", website: "", sellsReservations: true, sellsTickets: false, promos: [], cardLast4: "4242", subscriptionStatus: "demo" };
    const results = await Promise.allSettled([createAccount(one), createAccount(one), createAccount(one)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    for (const r of results) if (r.status === "rejected") expect(r.reason).toBeInstanceOf(EmailTakenError);
    expect(await db.user.count({ where: { email: "race@example.test" } })).toBe(1);
  });

  it("seeds the demo login idempotently", async () => {
    const [a, b] = await Promise.all([ensureDemoAccount(), ensureDemoAccount()]);
    expect(a.id).toBe(b.id);
    expect((await ensureDemoAccount()).email).toBe("demo@copperroom.com");
    expect(await db.user.count({ where: { isDemo: true } })).toBe(1);
  });
});

describe("signup — no-charge prototype billing", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("creates the account with only the card's last four digits", async () => {
    const user = await signup(body());
    const venue = await db.venue.findUniqueOrThrow({ where: { userId: user.id } });
    expect([venue.subscriptionStatus, venue.cardLast4, venue.stripeCustomerId, venue.timezone]).toEqual(["demo", "4242", null, "America/New_York"]);
    expect([venue.sellsReservations, venue.sellsTickets, venue.promoChannels]).toEqual([true, true, ["TikTok", "Email"]]);
  });

  it("a modified client that posts a full card number, expiry and CVC gets none of it stored", async () => {
    const hostile = { ...body(), card: { name: "Dana Test", last4: "4242", zip: "11201", number: "4242424242424242", exp: "12/30", cvc: "123" } } as SignupBody;
    const user = await signup(hostile);
    const everything = JSON.stringify(await db.user.findUniqueOrThrow({ where: { id: user.id }, include: { venue: true } }));
    expect(everything).not.toContain("4242424242424242");
    expect(everything).not.toContain("12/30");
    await expect(signup(body({ email: "b@example.test", card: { name: "Dana Test", last4: "4242424242424242", zip: "11201" } }))).resolves.toBeTruthy();
    expect((await db.venue.findFirstOrThrow({ where: { user: { email: "b@example.test" } } })).cardLast4).toBe("4242");
  });

  it("reports every invalid field at once and creates nothing", async () => {
    const err = await signup({ agree: false }).catch((e) => e);
    expect(err).toBeInstanceOf(FormError);
    expect(Object.keys(err.fields).sort()).toEqual(["agree", "card", "cardName", "city", "email", "name", "password", "sells", "venue", "zip"]);
    expect(await db.user.count()).toBe(0);
  });

  it("refuses an email that is already registered, and the demo login's address", async () => {
    await signup(body());
    const taken = await signup(body({ email: "DANA@example.test" })).catch((e) => e);
    expect(taken.fields).toEqual({ email: "An account with this email already exists. Log in instead." });
    // Nobody can register the public demo address and have "Explore the demo" hand out their account.
    const squat = await signup(body({ email: "demo@copperroom.com" })).catch((e) => e);
    expect(squat.fields).toEqual({ email: "An account with this email already exists. Log in instead." });
    await makeAccount({ email: "demo@copperroom.com", isDemo: false }); // however such a row got there…
    const demo = await ensureDemoAccount();
    expect([demo.isDemo, demo.venue?.name]).toEqual([true, "The Copper Room"]); // …the demo login is always the real demo
  });

  it("ignores an unknown venue type, sells option or time zone instead of storing it", async () => {
    const user = await signup(body({ vtype: "Casino", sells: ["Table reservations", "Yachts"], promos: ["Skywriting"], timezone: "Mars/Olympus" }));
    const venue = await db.venue.findUniqueOrThrow({ where: { userId: user.id } });
    expect([venue.type, venue.sellsTickets, venue.promoChannels, venue.timezone]).toEqual(["Restaurant", false, [], "America/New_York"]);
  });

  it("in production, sign-up is closed unless free accounts were explicitly accepted", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_DEMO_BILLING", "");
    expect(signupsOpen()).toBe(false);
    await expect(signup(body())).rejects.toMatchObject({ status: 503 });
    expect(await db.user.count()).toBe(0);
    vi.stubEnv("ALLOW_DEMO_BILLING", "1");
    expect(signupsOpen()).toBe(true);
    await expect(signup(body())).resolves.toBeTruthy();
  });
});

describe("access and request hardening", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("only paid-up (or demo-billing) venues may use the app", () => {
    expect(["active", "trialing", "past_due", "demo"].map(hasAccess)).toEqual([true, true, true, true]);
    expect(["pending", "canceled", "unpaid", "incomplete", "incomplete_expired", ""].map(hasAccess)).toEqual([false, false, false, false, false, false]);
  });

  it("rate-limit keys ignore the hop the caller wrote", () => {
    const req = (headers: Record<string, string>) => new Request("http://localhost/x", { headers });
    expect(clientKey(req({ "x-forwarded-for": "6.6.6.6, 203.0.113.77" }))).toBe("203.0.113.77");
    expect(clientKey(req({ "x-forwarded-for": "1.1.1.1, 203.0.113.77" }))).toBe("203.0.113.77");
    expect(clientKey(req({ "x-forwarded-for": "6.6.6.6", "cf-connecting-ip": "198.51.100.9" }))).toBe("198.51.100.9");
    expect(clientKey(req({}))).toBe("local");
    // An IPv6 caller owns a whole /64 — rotating inside it must not mint new buckets.
    expect(clientKey(req({ "cf-connecting-ip": "2001:db8:aa:bb:1:2:3:4" }))).toBe(clientKey(req({ "cf-connecting-ip": "2001:db8:aa:bb:ffff:0:0:9" })));
  });

  it("writes are accepted from the host they were sent to and from the configured origins — nowhere else", async () => {
    const ok = handler(async () => Response.json({ ok: true }));
    const post = (host: string, origin: string, extra: Record<string, string> = {}) => ok(new Request(`http://localhost:10000/api/x`, { method: "POST", headers: { host, origin, ...extra } }));
    const status = async (...a: Parameters<typeof post>) => (await post(...a)).status;
    vi.stubEnv("APP_URL", "");
    vi.stubEnv("RENDER_EXTERNAL_URL", "https://profit-monitr.onrender.com");
    // A custom domain attached without APP_URL keeps working, and so does the onrender.com name.
    expect(await status("www.copperroom.com", "https://www.copperroom.com")).toBe(200);
    expect(await status("profit-monitr.onrender.com", "https://profit-monitr.onrender.com")).toBe(200);
    expect(await status("www.copperroom.com", "https://profit-monitr.onrender.com")).toBe(200);
    // Another site is refused, and a forwarded-host header cannot vouch for it.
    expect(await status("www.copperroom.com", "https://evil.example")).toBe(403);
    expect(await status("www.copperroom.com", "https://evil.example", { "x-forwarded-host": "evil.example" })).toBe(403);
    expect(await status("www.copperroom.com", "null")).toBe(403);
    vi.stubEnv("RENDER_EXTERNAL_URL", "");
    expect(await status("localhost:3001", "http://localhost:3001")).toBe(200); // any local port in development
  });

  it("a limit meant for failures is spent only by failures, and cleared by success", () => {
    resetRateLimits();
    for (let i = 0; i < 19; i++) spend("login-failed:a@example.test", 60_000, 0);
    expect(blocked("login-failed:a@example.test", 20, 1)).toBe(false);
    spend("login-failed:a@example.test", 60_000, 2);
    expect(blocked("login-failed:a@example.test", 20, 3)).toBe(true);
    expect(blocked("login-failed:a@example.test", 20, 60_001)).toBe(false); // window over
    spend("login-failed:b@example.test", 60_000, 0);
    forgive("login-failed:b@example.test");
    expect(blocked("login-failed:b@example.test", 1, 1)).toBe(false);
  });

  it("redirects go to the configured origin, never to a forwarded host or an internal port", () => {
    const req = new Request("http://localhost:10000/r/v/ig", { headers: { host: "profit-monitr.onrender.com", "x-forwarded-host": "evil.example", "x-forwarded-proto": "https" } });
    vi.stubEnv("APP_URL", "");
    vi.stubEnv("RENDER_EXTERNAL_URL", "");
    expect(absoluteUrl(req, "/book/v").toString()).toBe("https://profit-monitr.onrender.com/book/v");
    vi.stubEnv("RENDER_EXTERNAL_URL", "https://profit-monitr.onrender.com");
    expect(absoluteUrl(req, "/app").toString()).toBe("https://profit-monitr.onrender.com/app");
    vi.stubEnv("APP_URL", "https://www.example.com");
    expect(absoluteUrl(req, "/app").toString()).toBe("https://www.example.com/app");
  });

  it("refuses bodies that are not JSON objects and strips NUL bytes", async () => {
    const post = (b: string) => new Request("http://localhost/x", { method: "POST", body: b });
    await expect(readJson(post("null"))).rejects.toBeInstanceOf(HttpError);
    await expect(readJson(post("[1]"))).rejects.toBeInstanceOf(HttpError);
    await expect(readJson(post("nope"))).rejects.toBeInstanceOf(HttpError);
    await expect(readJson(post('{"a":1}'))).resolves.toEqual({ a: 1 });
    expect(str("Sam\u0000 Guest ")).toBe("Sam Guest");
  });
});
