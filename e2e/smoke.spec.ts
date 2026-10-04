import { expect, test, type Page } from "@playwright/test";

const stamp = Date.now();
const owner = { name: "Dana Test", email: `e2e-${stamp}@example.test`, password: `E2e-${stamp}-pass!`, venue: `E2E Room ${stamp}`.slice(0, 18) };
const slug = owner.venue.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** No element may be wider than the viewport (the classic mobile overflow bug). */
async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

/** Each test starts signed out (fresh browser context). */
async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in →" }).click();
  await expect(page).toHaveURL(/\/app$/);
}

test.describe.configure({ mode: "serial" });

test("landing: message, sections, routing and SEO files", async ({ page, request }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto("/");
  await expect(page).toHaveTitle("Profit Monitr — Track what drives sales and reservations");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Don't just track likes. Track what drives sales and reservations.");
  for (const id of ["how", "brief", "pricing"]) await expect(page.locator(`#${id}`)).toBeVisible();
  await expect(page.locator("#agents")).toHaveCount(0); // the AI-agents claims are off the pre-launch site
  await expect(page.getByRole("img", { name: /Likes don't measure sales/ })).toBeVisible();
  await expect(page.locator(".ld-price")).toHaveText("$39.99");
  await expect(page.locator(".ld-dark-label")).toHaveText("Fictional sample venue · illustrative numbers");
  await page.getByRole("link", { name: "See a sample brief" }).first().click();
  await expect(page).toHaveURL(/\/brief\/sample$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("$48,920");
  await expect(page.getByText("Fictional sample venue · illustrative numbers")).toBeVisible();
  await page.goto("/");
  await page.getByRole("link", { name: "Start a free pilot" }).first().click();
  await expect(page).toHaveURL(/\/signup$/);
  expect(errors).toEqual([]);

  await page.goto("/pilot-terms");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("A free pilot, in plain words.");
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("What we collect, and why.");
  expect((await request.get("/robots.txt")).status()).toBe(200);
  expect(await (await request.get("/sitemap.xml")).text()).toContain("/brief/sample");
  expect(await (await request.get("/llms.txt")).text()).toContain("# Profit Monitr");
  expect((await request.get("/opengraph-image")).headers()["content-type"]).toContain("image/png");
  expect(await (await request.get("/api/health")).json()).toMatchObject({ ok: true });

  // The short-link domain serves tracked links directly once it points at the app.
  const short = await request.get("/the-copper-room/ig", { headers: { host: "monitr.link" }, maxRedirects: 0 });
  expect([short.status(), short.headers().location]).toEqual([302, "http://localhost:3211/book/the-copper-room?via=ig"]);
  // The shared demo venue shows its booking page but takes no real bookings.
  const prank = await request.post("/api/public/book", { data: { venue: "the-copper-room", via: "ig", name: "FREE BOTTLE", party: 4, date: "2026-12-01" } });
  expect(prank.status()).toBe(403);
});

test("signed-out visitors cannot reach the app or its API", async ({ page, request }) => {
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login$/);
  for (const path of ["/api/metrics", "/api/channels", "/api/actions", "/api/live", "/api/checkin", "/api/live/stream"]) {
    expect((await request.get(path)).status(), path).toBe(401);
  }
  expect((await request.post("/api/actions", { data: { id: "x" } })).status()).toBe(401);
  expect((await request.post("/api/cron/weekly-brief")).status()).toBeGreaterThanOrEqual(401);
});

test("sign-up: three steps with validation and no card, then the dashboard on sample data", async ({ page }) => {
  await page.goto("/signup");
  await page.getByRole("button", { name: "Continue →" }).click();
  await expect(page.getByText("Please enter your name.")).toBeVisible();
  await expect(page.getByText("Enter a valid email.")).toBeVisible();
  await expect(page.getByText("Use at least 8 characters.")).toBeVisible();

  await page.getByLabel("Full name").fill(owner.name);
  await page.getByLabel("Work email").fill(owner.email);
  await page.getByLabel("Password").fill(owner.password);
  await expect(page.locator(".au-meter")).toHaveAttribute("data-score", "4");
  await page.getByRole("button", { name: "Continue →" }).click();

  await expect(page.getByRole("heading", { name: "Tell us about your venue" })).toBeVisible();
  await page.getByLabel("Venue name").fill(owner.venue);
  await page.getByLabel("City").fill("Brooklyn, NY");
  await page.getByRole("radio", { name: "Bar & lounge" }).click();
  await page.getByRole("button", { name: "Email", exact: true }).click();
  // Where guests book: picking a platform asks for its page; this venue keeps Monitr's own page.
  await page.getByRole("radio", { name: "Posh", exact: true }).click();
  await expect(page.getByLabel("Your booking page")).toBeVisible();
  await page.getByRole("button", { name: "Continue →" }).click();
  await expect(page.getByText("Paste the page where guests book.")).toBeVisible();
  await page.getByRole("radio", { name: "Not yet — use Monitr's page" }).click();
  await page.getByRole("button", { name: "Continue →" }).click();

  await expect(page.getByRole("heading", { name: "Your free pilot" })).toBeVisible();
  await expect(page.getByText("No card today.")).toBeVisible();
  await expect(page.getByLabel(/card/i)).toHaveCount(0); // the prototype card form is gone
  await page.getByRole("button", { name: "Start my pilot →" }).click();
  await expect(page.getByText("Please agree to continue.")).toBeVisible();
  await page.getByRole("checkbox").check();

  // Nothing resembling billing data is sent — only the consent.
  const sent = page.waitForRequest((r) => r.url().endsWith("/api/auth/signup"));
  await page.getByRole("button", { name: "Start my pilot →" }).click();
  const payload = JSON.parse((await sent).postData() ?? "{}");
  expect(payload.card).toBeUndefined();
  expect(payload.agree).toBe(true);

  await expect(page.getByRole("heading", { name: "You're in, Dana." })).toBeVisible();
  await expect(page.getByText("Your tracked links and promo codes are ready")).toBeVisible();
  await expect(page.getByText(`First tracked link: monitr.link/${slug}/ig`)).toBeVisible();
  await page.getByRole("link", { name: "Go to your dashboard →" }).click();

  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByText("You're looking at a sample venue.")).toBeVisible();
  await expect(page.locator(".ov-figure")).toHaveText("$48,920");
  await expect(page.locator(".db-who")).toContainText(owner.venue);
});

test("dashboard: ranges, sorting, approvals that persist, and the real-data switch", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(owner.email);
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Log in →" }).click();
  await expect(page.getByText("We couldn’t find that email and password.")).toBeVisible();
  await page.getByLabel("Password").fill(owner.password);
  await page.getByRole("button", { name: "Log in →" }).click();
  await expect(page).toHaveURL(/\/app$/);

  // Range switch re-reads /api/metrics etc. and rescales every figure.
  await page.getByRole("button", { name: "Last week", exact: true }).click();
  await expect(page.locator(".ov-figure")).toHaveText("$41,582");
  await expect(page.getByText("WHAT HAPPENED · SEP 14–20")).toBeVisible();
  await page.getByRole("button", { name: "30 days", exact: true }).click();
  await expect(page.locator(".ov-figure")).toHaveText("$200,572");
  await page.getByRole("button", { name: "This week", exact: true }).click();

  const nav = page.getByRole("navigation", { name: "Sections" }).first();
  await nav.getByRole("button", { name: "Channels & content" }).click();
  await expect(page).toHaveURL(/tab=channels/);
  await expect(page.locator(".ch-row").first()).toContainText("Instagram influencers");
  await page.getByRole("button", { name: "Clicks", exact: true }).click();
  await expect(page.locator(".ch-row").first()).toContainText("Paid social");
  await expect(page.getByText("By clicks, the paid ad looks like your star.")).toBeVisible();

  await nav.getByRole("button", { name: /Next actions/ }).click();
  await page.locator(".act-row").first().getByRole("button", { name: "Approve" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Approved — scheduled for this week" })).toBeVisible();
  await expect(page.locator(".act-row").first()).toHaveClass(/is-approved/);
  await expect(nav.locator(".db-badge")).toHaveText("2");
  await page.reload();
  await expect(page.locator(".act-row").first()).toHaveClass(/is-approved/); // saved on the server
  await expect(page.locator(".act-row.is-approved")).toHaveCount(1);

  await page.getByRole("button", { name: "Ask the agent" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Your best move today is moving the paid-ad budget" })).toBeVisible();

  await nav.getByRole("button", { name: "Overview" }).click();
  await page.getByRole("button", { name: "Show my data" }).click();
  await expect(page.getByText("These are your own numbers")).toBeVisible();
  await expect(page.locator(".ov-figure")).toHaveText("$0");
});

test("attribution loop: tracked link → booking → door check-in → revenue on the dashboard", async ({ page }) => {
  await page.goto(`/r/${slug}/ig`);
  await expect(page).toHaveURL(new RegExp(`/book/${slug}\\?via=ig$`));
  await expect(page.getByText("You're booking with code")).toContainText("INSTA");
  await page.getByLabel("Your name").fill("Sam Guest");
  await page.getByLabel("Guests").fill("4");
  await page.getByLabel("Date").fill(new Date().toLocaleDateString("en-CA"));
  await page.getByRole("button", { name: "Book my table →" }).click();
  await expect(page.getByRole("heading", { name: "You're booked, Sam." })).toBeVisible();
  const code = (await page.locator(".bk-confirmation").innerText()).trim();

  // The guest booked signed out; the owner now signs in to work the door.
  await login(page, owner.email, owner.password);
  await page.goto("/app/door");
  await page.getByLabel("Confirmation code").fill(code);
  await page.getByLabel(/Bill/).fill("212.40");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Sam Guest — party of 4 checked in · code INSTA · $212.40")).toBeVisible();
  await page.getByLabel("Confirmation code").fill(code);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Sam Guest already checked in.")).toBeVisible(); // never counted twice
  // A mistyped bill can be corrected from the list without checking the party in again.
  await page.getByRole("button", { name: "Edit bill" }).click();
  await expect(page.getByLabel("Confirmation code")).toHaveValue(code);
  await page.getByLabel(/Bill/).fill("212.40");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Sam Guest — bill set to $212.40")).toBeVisible();

  await page.goto("/app");
  await expect(page.locator(".ov-figure")).toHaveText("$212");
  await expect(page.locator(".db-liveline")).toContainText("4 guests in tonight · $212 so far");
  await page.getByRole("navigation", { name: "Sections" }).first().getByRole("button", { name: "Revenue" }).click();
  await expect(page.locator(".rev-row").first()).toContainText("Instagram");
  await expect(page.locator(".rev-row").first()).toContainText("$212");

  // Overlay: a link can point at the venue's own platform instead. The owner's session carries the API calls.
  const channels = (await (await page.request.get("/api/channels?range=week")).json()).channels as { id: string; code: string }[];
  const email = channels.find((c) => c.code === "EMAIL")!;
  const bad = await page.request.patch(`/api/channels/${email.id}`, { data: { destination: "https://evil.example/phish" } });
  expect(bad.status()).toBeGreaterThanOrEqual(400);
  expect((await bad.json()).fields.destination).toContain("Links can point at");
  expect((await page.request.patch(`/api/channels/${email.id}`, { data: { destination: "www.eventbrite.com/e/jazz-night-123" } })).status()).toBe(200);
  const tracked = await page.request.get(`/r/${slug}/email`, { maxRedirects: 0 });
  expect([tracked.status(), tracked.headers().location]).toEqual([302, "https://www.eventbrite.com/e/jazz-night-123?aff=email"]);
  await page.goto("/app?tab=channels");
  await expect(page.locator(".ch-row.is-clicks")).toHaveCount(1);
  await expect(page.locator(".ch-row.is-clicks")).toContainText("clicks only — bookings happen on Eventbrite");
  expect((await page.request.patch(`/api/channels/${email.id}`, { data: { destination: "" } })).status()).toBe(200);
  const back = await page.request.get(`/r/${slug}/email`, { maxRedirects: 0 });
  expect(back.headers().location).toBe(`http://localhost:3211/book/${slug}?via=email`);
});

test("demo venue: one button in, read-only on the server, and usable on a phone", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Your Monday brief is waiting." })).toBeVisible();
  await expect(page.getByText("monitr123")).toHaveCount(0); // credentials are no longer printed
  await page.getByRole("button", { name: "Explore the demo venue" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.locator(".db-who")).toContainText("The Copper Room");
  await expect(page.getByText("You're looking at a sample venue.")).toHaveCount(0);

  await page.goto("/app?tab=website");
  await page.locator(".rec").first().getByRole("button", { name: "Approve" }).click();
  await expect(page.locator(".rec").first()).toHaveClass(/is-approved/);
  await expect(page.locator(".agent-status").nth(1)).toHaveText("Working");
  await page.reload();
  await expect(page.locator(".rec.is-approved")).toHaveCount(0); // one visitor's taps never change the next visitor's demo

  // The live feed is streamed from the server.
  await page.goto("/app?tab=live");
  await expect(page.locator(".feed-row")).toHaveCount(6);
  await expect(page.locator(".feed-row")).toHaveCount(7, { timeout: 12_000 });

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/app");
  await expect(page.locator(".db-side")).toBeHidden();
  await expect(page.locator(".db-tabs")).toBeVisible();
  for (const tab of ["revenue", "reservations", "channels", "live", "actions", "website"]) {
    await page.goto(`/app?tab=${tab}`);
    await expectNoHorizontalScroll(page);
  }
  await page.context().clearCookies();
  for (const path of ["/", "/signup", "/login"]) {
    await page.goto(path);
    await expectNoHorizontalScroll(page);
  }
});
