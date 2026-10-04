# Profit Monitr

**Don't just track likes. Track what drives sales and reservations.**

An attribution service for bars, clubs, event venues and restaurants. It sits
on top of the booking page a venue already uses — Posh, Eventbrite, Resy,
OpenTable or its own site — gives every influencer, promoter and campaign a
tracked link and promo code, traces clicks → bookings and ticket orders →
guests at the door → revenue, and sends a plain-language brief every Monday.
Free during a pilot; $39.99 a month after. Nothing is migrated and no money
passes through Monitr.

Full-stack **Next.js 16 (App Router) + TypeScript**, **Prisma 7 + PostgreSQL**,
deployable to **Render** with the included `render.yaml`. The layout follows the
design handoff mirrored in [`docs/design-handoff/`](docs/design-handoff/README.md);
the positioning follows the peer-reviewed plan in
[`claude-reports/Product-Plan/`](claude-reports/Product-Plan/overlay-repositioning-plan-2026-10-03.md).

## What's in the box

| Route | What it is |
| --- | --- |
| `/` | Landing page: hero with the 21-second "Likes Not Sales" film, three promises, how it works, the weekly brief, pricing, close |
| `/brief/sample` | A complete Monday brief for the fictional sample venue, rendered from the same sample provider as the demo |
| `/signup` | Three-step sign-up (account → venue, including where guests book today → pilot terms; no card) and the "You're in" screen |
| `/login` | Log in, plus an "Explore the demo venue" button (read-only shared venue) |
| `/privacy` · `/pilot-terms` | Plain-language privacy notice and pilot terms, written from what the app does |
| `/app` | The app: Overview · Revenue · Reservations & tickets (with order uploads and export) · Channels & content (with each link's destination) · Live · Next actions · Website & SEO (`/app?tab=revenue` deep-links a section) |
| `/app/door` | Door check-in — turns a booking into a "guest at the door" and records the bill |
| `/book/<venue>` | Monitr's own booking page (tables and tickets) — the fallback for venues with no platform |
| `/r/<venue>/<channel>[/<content>]` | Tracked-link redirect: logs the click, sends the guest to the channel's own link, else the venue's booking page, else `/book/<venue>` with the source attached |
| `/robots.txt` `/sitemap.xml` `/llms.txt` `/opengraph-image` | SEO and AI-agent files |

### API (route handlers under `src/app/api`)

All dashboard endpoints require the session cookie and only ever return the
signed-in venue's data. Writes are same-origin checked; the demo venue is
read-only on the server.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/metrics?range=week\|last\|month` | Headline figures, deltas, revenue chart, summary, the platform/door revenue split |
| `GET /api/channels?range=` · `POST /api/channels` · `PATCH /api/channels/:id` | Sources with clicks, guests, revenue and fidelity · create a tracked link + code · set a link's own destination |
| `GET /api/content?range=` · `POST /api/content` | Posts/emails/ads with guests and revenue · track a new piece |
| `GET /api/reservations?range=` | Bookings by day, where they came from, coming up |
| `POST /api/imports` · `GET /api/imports` | Upload a platform's orders export (`dryRun: true` previews) · recent uploads |
| `GET /api/export` | Every booking as a CSV download |
| `GET /api/live` · `GET /api/live/stream` | Tonight so far · Server-Sent Events for new activity |
| `GET/POST /api/actions` | This week's three moves and last week's results · approve one |
| `GET/POST /api/website/recommendations` | Site KPIs, agents, proposed changes · approve one |
| `POST /api/live/note` · `POST /api/expert` | Go ahead with the agent's note · request a call |
| `POST /api/events` | Create a ticketed night / bookable service |
| `GET/POST/DELETE /api/checkin` | Door list · check a party in (a table's bill can be added or corrected later the same way) · release a booking that has not arrived |
| `PATCH /api/venue` | `{ sampleData }` switches sample/own data · `{ bookingProvider, bookingUrl }` sets where links send people |
| `POST /api/public/book` | Public booking on Monitr's page (rate limited, no sign-in) |
| `POST /api/auth/{signup,login,logout,demo,check-email}` | Accounts and sessions |
| `POST /api/cron/weekly-brief` | Build and email the Monday brief for every venue where it is Monday morning locally (`Authorization: Bearer $CRON_SECRET`; call it hourly on Mondays) |
| `GET /api/health` | Render health check (process + database); `launch` lists the public facts still unset before outreach |

### Where tracked links go

A venue says where guests book today (sign-up step 2, or **Channels → Change**):
Posh, Eventbrite, Resy, OpenTable, Partiful, its own site, or "not yet" (Monitr's
page). Each channel can also carry its own destination — the platform's tracking
link for that promoter or campaign — under **Channels → Own link**. The redirect
prefers the channel's link, then the venue's page, then `/book/<venue>`.
Eventbrite links get `aff=<channel>` so Eventbrite's own reports credit the
source too.

Every destination is validated when it is saved
([`src/lib/destinations.ts`](src/lib/destinations.ts)): https only, no port or
credentials, a known platform host (subdomains allowed, suffix spoofs not) or the
venue's own website, never a link shortener or link-in-bio host, never this app.
A venue's website is whatever the owner typed, so **links to it go live only
after you verify the site** — until then they fall back to Monitr's page and the
owner sees a note saying so.

**Verifying a venue's website** (one row, after you have looked at the site):

```sql
UPDATE "Venue" SET "websiteVerified" = true WHERE slug = 'the-venue-slug';
```

### What a source can prove

Every channel row carries a `fidelity`:

- **exact** — its link lands on Monitr's page: clicks, bookings and door
  check-ins are all measured here.
- **platform** — its link lands on a platform and that platform's orders have
  been uploaded for the period: bookings are as the export reports them; the
  click-to-order rate stands in for click-to-door.
- **clicks** — its link lands on a platform and nothing has been uploaded:
  clicks only. Such a source is "Getting clicks", never "Not working"; it
  shows "—" for door, revenue, rate and return; it is never ranked worst; and the
  Monday brief asks for the platform's orders instead of telling the venue to
  pause its best link.

### Importing platform orders

**Reservations & tickets → Upload your platform's orders.** Pick Posh, Eventbrite
or OpenTable, choose the CSV, read the preview (rows, new vs already here,
skipped lines with reasons, which channel each order goes to, how many carry no
code or link), then import. [`src/lib/imports.ts`](src/lib/imports.ts):

- Columns are matched by a tolerant alias table (`findColumns`); the preview
  names any required column it cannot find (order id, order date). **Check the
  mapping against the pilot's real export before relying on it** — the aliases
  come from the platforms' documentation, not from files seen in production.
- Each order is credited to the channel whose promo code it carries, else the
  channel whose slug/name matches its tracking link, affiliate or source
  column; otherwise it is counted as **platform / unattributed** (real sales,
  credited to no source — shown on Revenue and in the email, never as "direct").
- Rows upsert on `(venueId, provider, externalId)`: uploading a newer export
  updates the same orders, nothing is counted twice; a refund or cancellation in
  a later file sets the order to $0 and 0 tickets. The most recently uploaded
  file wins, so upload exports in date order.
- Money is parsed to integer cents (`$1,204.50`, `(15.00)`, `USD 30.00`;
  comma decimals are refused, not misread). Order times are read as the venue's
  wall clock unless they carry a zone; the day is validated (no Feb 31).
- An imported paid order is **revenue at `paidAt`** (when the platform took the
  money); a booking made on Monitr's page is revenue at check-in, as before. The
  Overview headline is the credited total; Revenue and the Monday email show the
  two bases separately. Attendance from the export feeds "guests at the door"
  but not the show rate, which stays a door measurement.
- Uploads stay out of the Live feed; they count in every total. Limit 2 MB per
  file (export a month at a time).

### Sample data vs. your data

The handoff's dashboard is a finished week at "The Copper Room", a fictional
venue. That dataset lives in [`src/data/sample.ts`](src/data/sample.ts) and is
what the **demo login** and `/brief/sample` always show. A **new venue** starts on
the same sample (with a first-week checklist) and switches to **its own measured
numbers** with one button; the two are never blended. Real numbers come from
tracked clicks, bookings on Monitr's page, uploaded platform orders and door
check-ins (definitions at the top of
[`src/lib/dashboard/real.ts`](src/lib/dashboard/real.ts)).

Try the loop end to end: sign up, press **Show my data**, open
`/r/<your-venue>/ig`, book a table, then check the code in on **Live → Door
check-in** with a bill. Or set a Posh page under Channels, share the link, and
upload the Posh export under Reservations & tickets.

## Run it locally

Requirements: Node 20.9+ (22.14 pinned) and a local PostgreSQL.

```bash
cp .env.example .env            # set DATABASE_URL
npm install                     # also runs prisma generate
npm run db:migrate              # applies migrations
npm run db:seed                 # creates the demo login
npm run dev                     # http://localhost:3000
```

Demo: press **Explore the demo venue** on `/login` or **Explore the demo** on the
landing page (the shared account's credentials are in `src/data/sample.ts`).

| Script | |
| --- | --- |
| `npm run lint` · `npm run typecheck` | ESLint · `next typegen` + `tsc` |
| `npm test` | Vitest — unit tests plus integration tests against `<database>_test` on the same local server (create it once: `createdb profit_monitr_test`) |
| `npm run test:e2e` | Playwright smoke suite in your installed Chrome, against a production build on port 3211 and the test database |
| `npm run build` · `npm start` | Production build · serve it |

## Deploy on Render

1. Push this folder to a GitHub repo.
2. Render → **New → Blueprint** → select the repo. `render.yaml` creates a
   Postgres database and a Node web service, wires `DATABASE_URL`, generates
   `CRON_SECRET`, opens sign-up (`ALLOW_SIGNUPS=1`), runs `prisma migrate deploy`
   and the demo seed on every deploy, and health-checks `/api/health`.
3. Optional: attach a custom domain and set `APP_URL` to it (until then the app
   uses Render's own URL for canonical links, the sitemap and emails).
4. Optional: schedule `POST /api/cron/weekly-brief` hourly on Mondays — the
   Render cron block is in `render.yaml`, commented out because cron jobs are a
   paid add-on; any scheduler that can send a bearer token works.
5. After the first deploy, check which header carries the visitor's address
   behind Render's proxy (`clientKey()` in `src/lib/api.ts`); rate limits and
   click de-duplication key on it.

### Before launch

`GET /api/health` lists what is still missing under `launch`. In order:

1. **Who stands behind it** — fill `CONTACT` in [`src/data/site.ts`](src/data/site.ts)
   (founder, legal entity, contact email, scheduling link). The footer, the
   legal pages and the "Book a 15-minute call" button render only when set.
2. **A real domain** — set `APP_URL`; point `NEXT_PUBLIC_LINK_HOST` at the
   service (tracked links show that host). Resend needs a verified sending
   domain before Monday briefs reach anyone but you.
3. **Email** — `RESEND_API_KEY` and `EMAIL_FROM` on that domain.
4. **The brief** — a scheduler for step 4 above.
5. **Database** — move off Render's free plan (free databases expire after 30
   days).
6. **Sign-up policy** — keep `ALLOW_SIGNUPS=1` for open pilots, or remove it
   and create pilot accounts yourself.
7. Review `/pilot-terms` and `/privacy` (product descriptions, not legal advice).

### Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection string |
| `APP_URL` | no | Public origin; defaults to `RENDER_EXTERNAL_URL` on Render. Also one of the app's own hosts a destination may never point at |
| `NEXT_PUBLIC_LINK_HOST` | no | Display host for tracked links (default `monitr.link`). Links resolve through `<app>/r/…` until that domain points at the service |
| `CRON_SECRET` | for the brief | Protects the weekly-brief endpoint; unset = endpoint disabled |
| `ALLOW_SIGNUPS` | in production | `1` opens free pilot sign-up. Unset in production = sign-up closed (the demo and existing accounts keep working). `render.yaml` sets it |
| `RESEND_API_KEY`, `EMAIL_FROM` | no | Transactional email; without a key messages are printed to the server log |
| `OPS_EMAIL` | no | Where call requests are sent |
| `NEXT_PUBLIC_ANALYTICS_SRC`, `NEXT_PUBLIC_ANALYTICS_SITE` | no | Cookieless page analytics (Plausible: hostname; Umami: website id). Nothing loads unless both are set; build-time values |

### Billing

**Nobody is charged.** Accounts are free pilots: sign-up collects no card, the
consent line links to the pilot terms and the privacy notice, and
`subscriptionStatus` is `"pilot"`. The plan is $39.99 a month after the pilot,
only if the venue chooses to continue — a separate agreement.

Subscription billing is **not built**. A Stripe path was ported from the
earlier app and then removed: an independent review found charge-without-account
and double-charge scenarios in its retry handling, and it could not be run
against Stripe (no test keys). The findings and the recommended design are in
[`claude-reports/Money-Safety/`](claude-reports/Money-Safety/money-safety-review-2026-10-03.md).
The `Venue` billing columns and the access gate (`hasAccess` in
`src/lib/auth.ts`) are in place for it. Monitr never processes a guest's
payment either: ticket money stays with the venue's platform.

## How it is built

- **Design tokens** — [`src/styles/tokens.css`](src/styles/tokens.css) holds
  every colour, radius, type size and motion value from the handoff;
  components use the custom properties only.
- **Content in data files** — landing copy in `src/data/landing.ts`, brand and
  contact facts in `src/data/site.ts`, the sample venue in `src/data/sample.ts`.
- **Hero film** — the handoff's React composition ported to TypeScript on a
  small clock (`src/components/landing/film/`). It pauses off-screen and in
  background tabs and shows one still frame under `prefers-reduced-motion`.
- **Time zones** — everything is stored in UTC (`timestamptz`); each venue has
  an IANA zone (taken from the browser at sign-up) that decides its weeks, its
  "today", when Monday is, and how an uploaded export's times are read.
- **Concurrency** — approvals and check-ins are single conditional updates;
  ticket capacity and the call request lock a row; emails, venue slugs, promo
  codes and imported order ids are settled by unique indexes.
- **Destinations and imports** — [`src/lib/destinations.ts`](src/lib/destinations.ts)
  (allow-list, tracking parameters, verification gate) and
  [`src/lib/imports.ts`](src/lib/imports.ts) (CSV reader, column aliases,
  attribution, idempotent upsert).

## Differences from the handoff

The three reference screens' layout and interactions are reproduced; measured
at 1440 px, section and control geometry matches the reference to the pixel.
The **copy and positioning deliberately differ**: the handoff sells native
reservations and ticketing; the product tracks alongside the booking page a venue
already uses (see the plan in `claude-reports/Product-Plan/`). Other deliberate
differences:

| What | Why |
| --- | --- |
| Sign-up step 3 is the pilot agreement, not a card form | Collecting card numbers that are never charged is a liability and the easiest "what's the catch"; nobody is charged |
| Step 2 asks where guests book today | Tracked links have to land there |
| No AI-agents section, "expert guidance" or "SEO" claims on the landing page | Nobody performs that work yet; the in-app Website section stays, labelled "first scan pending" on real data |
| `/brief/sample`, `/privacy`, `/pilot-terms`; the brief card is labelled a fictional sample venue; demo credentials are not printed | Trust layer for a pre-launch site |
| `/book/<venue>`, `/r/<venue>/<slug>`, `/app/door` exist | The handoff shows attribution results but no way to produce them; these make click → booking → door real. Built from the same tokens and patterns |
| Channels shows where each link goes and lets the owner change it; Reservations & tickets has the order upload and the export | The handoff has no settings screens; without these the overlay cannot be configured |
| Clicks-only sources get "Getting clicks" and "—", never a conversion verdict | A link that lands on Posh cannot prove what happened after the click |
| "Door check-in →" link in Live → Activity | Entry point to the door screen |
| Sample-data notice with a first-week checklist (not for the demo login) | A new venue's dashboard would otherwise present another venue's numbers as its own |
| "Log out" (sidebar bottom / end of the tab row) | The prototype has no sessions |
| Empty and zero states in every section | Needed once numbers are real |
| Hero stacks under 720 px; header drops "Log in" under 480 px | The reference hero does not collapse on phones |
| "Current website (optional)" stays on one line | In the reference the label wraps inside its grid and stretches the City field to 58 px |
| Step-3 spinner lasts as long as the request (minimum 0.7 s) instead of a fixed 1.4 s | It now reflects real work |
| Live feed times are real timestamps | The prototype ages every row three minutes per tick |
| A negative delta ("−3% vs previous") is not tinted green | The handoff README says deltas are mint "when positive" |
| Page title is "Profit Monitr — …" on the landing page | The reference alternates between "Monitr" and "Profit Monitr" |
| No black page frame under 720 px: the canvas runs edge to edge with square corners | On a phone the 16 px frame reads as a black border, not a frame |

## Open questions

These need a decision from the client; none is invented in the build.

1. **Billing.** Nobody is charged (see "Billing"). Taking the $39.99 after a
   pilot needs Stripe test keys, hosted Checkout, a webhook to keep subscription
   status current, and the cancel flow the landing page promises.
2. **Legal text.** `/pilot-terms` and `/privacy` describe what the product does,
   in plain language; have counsel read them before outreach.
3. **Platform export columns.** The import's column aliases follow the
   platforms' documentation; the first pilot's real Posh/Eventbrite/OpenTable
   file decides whether they need adjusting (the preview will say what is
   missing). Partiful is not imported yet.
4. **Website verification** is a manual SQL update per venue (above). Fine for
   three pilots; an admin screen or a DNS/meta-tag check comes later.
5. **AI agents.** Website & SEO, the agent note and "Ask the agent" are
   presentation only: no agent scans a site, and "Ask the agent" surfaces the
   top open action rather than calling a model. For a venue on its own data the
   section says "first scan pending".
6. **"Send the email"** records the owner's approval; no email goes to guests.
7. **Managing links, content, events and ad spend.** Destinations are editable;
   creating more links, content or events still goes through
   `POST /api/channels`, `/api/content`, `/api/events`.
8. **Tickets on Monitr's page are "pay at the door".** An order holds the
   tickets (ten per order at most) and becomes revenue at check-in. Selling
   tickets online through Monitr would make it a booking system again and is off
   the roadmap until a pilot asks.
9. **Password reset** is not built.
10. **`monitr.link`** is a display host until that domain is bought and pointed
    at the service.
11. **Landing and sample figures** (The Copper Room) are fictional sample
    numbers from the design, labelled as such, not customer results.
