# Profit Monitr

**Don't just track likes. Track what drives sales and reservations.**

A $39.99/month service for restaurants, bars and venues: native reservations
and ticketing, a tracked link and promo code for every influencer, promoter and
campaign, click → booking → guest at the door → revenue attribution, a
plain-language brief every Monday, and AI-agent recommendations for the venue's
website.

Full-stack **Next.js 16 (App Router) + TypeScript**, **Prisma 7 + PostgreSQL**,
deployable to **Render** with the included `render.yaml`. Built from the design
handoff mirrored in [`docs/design-handoff/`](docs/design-handoff/README.md).

## What's in the box

| Route | What it is |
| --- | --- |
| `/` | Landing page: hero with the 21-second "Likes Not Sales" film, three promises, how it works, the weekly brief, AI agents, pricing, close |
| `/signup` | Three-step sign-up (account → venue → billing) and the "You're in" screen |
| `/login` | Log in (same screen, log-in mode). Demo login is printed on the page |
| `/app` | The app: Overview · Revenue · Reservations & tickets · Channels & content · Live · Next actions · Website & SEO (`/app?tab=revenue` deep-links a section) |
| `/app/door` | Door check-in — turns a booking into a "guest at the door" and records the bill |
| `/book/<venue>` | The venue's public booking page (tables and tickets) |
| `/r/<venue>/<channel>[/<content>]` | Tracked-link redirect: logs the click, forwards to the booking page with the source attached |
| `/robots.txt` `/sitemap.xml` `/llms.txt` `/opengraph-image` | SEO and AI-agent files |

### API (route handlers under `src/app/api`)

All dashboard endpoints require the session cookie and only ever return the
signed-in venue's data.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/metrics?range=week\|last\|month` | Headline figures, deltas, revenue chart, summary |
| `GET /api/channels?range=` · `POST /api/channels` | Sources with clicks, guests, revenue · create a tracked link + code |
| `GET /api/content?range=` · `POST /api/content` | Posts/emails/ads with guests and revenue · track a new piece |
| `GET /api/reservations?range=` | Bookings by day, where they came from, coming up |
| `GET /api/live` · `GET /api/live/stream` | Tonight so far · Server-Sent Events for new activity |
| `GET/POST /api/actions` | This week's three moves and last week's results · approve one |
| `GET/POST /api/website/recommendations` | Site KPIs, agents, proposed changes · approve one |
| `POST /api/live/note` · `POST /api/expert` | Go ahead with the agent's note · request the strategist session |
| `POST /api/events` | Create a ticketed night / bookable service |
| `GET/POST/DELETE /api/checkin` | Door list · check a party in (a table's bill can be added or corrected later the same way) · release a booking that has not arrived |
| `PATCH /api/venue` | Switch between the sample venue and the venue's own data |
| `POST /api/public/book` | Public booking (rate limited, no sign-in) |
| `POST /api/auth/{signup,login,logout,demo,check-email}` | Accounts and sessions |
| `POST /api/cron/weekly-brief` | Build and email the Monday brief for every venue where it is Monday morning locally (`Authorization: Bearer $CRON_SECRET`; call it hourly on Mondays) |
| `GET /api/health` | Render health check (process + database) |

### Sample data vs. your data

The handoff's dashboard is a finished week at "The Copper Room". That dataset
lives in [`src/data/sample.ts`](src/data/sample.ts) and is what the **demo
login** always shows. A **new venue** starts on the same sample (with a notice
saying so) and switches to **its own measured numbers** with one button; the
two are never blended. Real numbers come from tracked clicks, bookings and door
check-ins (definitions at the top of
[`src/lib/dashboard/real.ts`](src/lib/dashboard/real.ts)). **Revenue counts
when a party checks in** — that is when money is taken (tickets are pay at the
door) — so a booking that never arrives is never revenue.

Try the loop end to end: sign up, press **Show my data**, open
`/r/<your-venue>/ig`, book a table, then check the code in on **Live → Door
check-in** with a bill. The click, booking, guests and revenue appear on every
section, credited to that link.

## Run it locally

Requirements: Node 20.9+ (22.14 pinned) and a local PostgreSQL.

```bash
cp .env.example .env            # set DATABASE_URL
npm install                     # also runs prisma generate
npm run db:migrate              # applies migrations
npm run db:seed                 # creates the demo login
npm run dev                     # http://localhost:3000
```

Demo login: shown on `/login` (The Copper Room), or press **Explore the demo**
on the landing page.

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
   `CRON_SECRET`, runs `prisma migrate deploy` and the demo seed on every
   deploy, and health-checks `/api/health`.
3. Optional: attach a custom domain and set `APP_URL` to it (until then the app
   uses Render's own URL for canonical links, the sitemap and emails).
4. Optional: schedule `POST /api/cron/weekly-brief` hourly on Mondays — the
   Render cron block is in `render.yaml`, commented out because cron jobs are a
   paid add-on.
5. After the first deploy, check which header carries the visitor's address
   behind Render's proxy (`clientKey()` in `src/lib/api.ts`); rate limits and
   click de-duplication key on it.

Before real customers: move the database off Render's free plan (free
databases expire after 30 days) and read "Billing" and "Open questions" below.

### Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection string |
| `APP_URL` | no | Public origin; defaults to `RENDER_EXTERNAL_URL` on Render |
| `NEXT_PUBLIC_LINK_HOST` | no | Display host for tracked links (default `monitr.link`). Links resolve through `<app>/r/…` until that domain points at the service |
| `CRON_SECRET` | for the brief | Protects the weekly-brief endpoint; unset = endpoint disabled |
| `ALLOW_DEMO_BILLING` | in production | `1` accepts free (no-charge) sign-ups. Unset in production = sign-up closed. `render.yaml` sets it |
| `RESEND_API_KEY`, `EMAIL_FROM` | no | Transactional email; without a key messages are printed to the server log |
| `OPS_EMAIL` | no | Where strategist-session requests are sent |

### Billing

**Nobody is charged.** Step 3 of sign-up is the handoff's prototype card form:
the page says "Prototype — no payment is processed", the fields are validated
in the browser, and only the cardholder name, the last four digits and the ZIP
are sent to the server. A production deployment therefore keeps sign-up closed
unless `ALLOW_DEMO_BILLING=1` says free accounts are acceptable there.

Real $39.99/month billing is **not built**. A Stripe subscription path was
ported from the earlier app and then removed: an independent review found
charge-without-account and double-charge scenarios in its retry handling, and
it could not be run against Stripe (no test keys). The findings and the
recommended design are in
[`claude-reports/Money-Safety/`](claude-reports/Money-Safety/money-safety-review-2026-10-03.md).
The `Venue` billing columns and the access gate (`hasAccess` in
`src/lib/auth.ts`) are in place for it.

## How it is built

- **Design tokens** — [`src/styles/tokens.css`](src/styles/tokens.css) holds
  every colour, radius, type size and motion value from the handoff;
  components use the custom properties only.
- **Content in data files** — landing copy in `src/data/landing.ts`, brand in
  `src/data/site.ts`, the sample venue in `src/data/sample.ts`.
- **Hero film** — the handoff's React composition ported to TypeScript on a
  small clock (`src/components/landing/film/`). It pauses off-screen and in
  background tabs and shows one still frame under `prefers-reduced-motion`.
- **Time zones** — everything is stored in UTC (`timestamptz`); each venue has
  an IANA zone (taken from the browser at sign-up) that decides its weeks, its
  "today" and when Monday is.
- **Concurrency** — approvals and check-ins are single conditional updates;
  ticket capacity and the strategist request lock a row; emails, venue slugs
  and promo codes are settled by unique indexes.

## Differences from the handoff

Everything in the three reference screens is reproduced; measured at 1440 px,
section and control geometry matches the reference to the pixel. Deliberate
differences:

| What | Why |
| --- | --- |
| `/book/<venue>`, `/r/<venue>/<slug>`, `/app/door` exist | The handoff shows attribution results but no way to produce them; these three make click → booking → door real. Built from the same tokens and patterns |
| "Door check-in →" link in Live → Activity | Entry point to the above |
| Sample-data notice + switch at the top of the app (not for the demo login) | A new venue's dashboard would otherwise present another venue's numbers as its own |
| "Log out" (sidebar bottom / end of the tab row) | The prototype has no sessions |
| Empty and zero states in every section | Needed once numbers are real |
| Hero stacks under 720 px; header drops "Log in" under 480 px | The reference hero does not collapse on phones (the headline wraps one word per line and the header overflows) |
| "Current website (optional)" stays on one line | In the reference the label wraps inside its grid and stretches the City field to 58 px |
| Step-3 spinner lasts as long as the request (minimum 0.7 s) instead of a fixed 1.4 s | It now reflects real work |
| Live feed times are real timestamps | The prototype ages every row three minutes per tick |
| A negative delta ("−3% vs previous") is not tinted green | The handoff README says deltas are mint "when positive" |
| Page title is "Profit Monitr — …" on the landing page | The reference alternates between "Monitr" and "Profit Monitr" |
| No black page frame under 720 px: the canvas runs edge to edge with square corners | On a phone the 16 px frame reads as a black border, not a frame. One media query on the frame tokens in `src/styles/tokens.css` |

## Open questions

These need a decision from the client; none is invented in the build.

1. **Billing.** Nobody is charged yet (see "Billing"). Taking the $39.99 needs
   Stripe test keys, a decision on hosted Checkout vs. an embedded form, a
   webhook to keep subscription status current, and the cancel /
   billing-management flow the landing page promises ("cancel anytime") — none
   of which is in the handoff.
2. **Terms.** The consent line links to nothing — there is no Terms or Privacy
   page in the handoff.
3. **AI agents.** Website & SEO, the agent note and "Ask the agent" are
   presentation only: no agent scans a site, and "Ask the agent" surfaces the
   top open action rather than calling a model. For a venue on its own data the
   section says "first scan pending".
4. **"Send the email"** records the owner's approval; no email goes to guests
   (there is no subscriber list or mail integration behind it).
5. **Managing links, content, events and ad spend.** The handoff has no screen
   for these. A venue gets one link per place it said it promotes; more can be
   created through `POST /api/channels`, `/api/content`, `/api/events`.
6. **Tickets are "pay at the door".** An order holds the tickets (ten per
   order at most) and records what is owed; it becomes revenue at check-in.
   Staff can release a booking that does not arrive. Selling tickets online
   needs the payment work in question 1.
7. **Password reset** is not in the handoff and not built.
8. **`monitr.link`** is a display host until that domain is bought and pointed
   at the service.
9. **Landing figures** ("Illustrative results", The Copper Room brief) are
   sample numbers from the design, not customer results.
