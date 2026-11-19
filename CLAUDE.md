# Profit Monitr

Attribution SaaS for bars, clubs, event venues and restaurants. It sits on top
of the booking page a venue already uses (Posh, Eventbrite, Resy, OpenTable,
own site): tracked links and promo codes per influencer/promoter/campaign,
click → booking / imported platform order → door check-in → revenue
attribution, and a Monday brief with three ranked actions. Free pilot, $39.99 a
month after; nobody is charged. Public screens: landing (`/`), sample brief
(`/brief/sample`), sign-up / log-in (`/signup`, `/login`), `/privacy`,
`/pilot-terms`; the seven-section app (`/app`); the door (`/app/door`); the
fallback booking page (`/book/<venue>`); the redirect (`/r/<venue>/<slug>`).

Built from the design handoff at `~/Downloads/design_handoff_profit_monitr`
(mirrored read-only in `docs/design-handoff/`). **That README is the source of
truth for look and interactions; the `.dc.html` files are the pixel
reference. Copy and positioning are NOT taken from it** — they follow the
peer-reviewed plan in `claude-reports/Product-Plan/` and live in
`src/data/landing.ts` / `src/data/site.ts`. Do not restore "we set up your
reservations and ticketing", the card form, or the AI-agents section from the
handoff. README.md here has the route table, API, env vars and deploy steps.

Predecessor: `~/Development/code/web-apps/track-profit-monitr` (the earlier
"Modernist" design). This project replaced it and ported its backend; don't
build there.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript. This Next differs from
  training data — read `node_modules/next/dist/docs/` before using an API.
  Route types (`PageProps`, `LayoutProps`, `RouteContext`) are generated:
  `npm run typecheck` runs `next typegen` first.
- Prisma 7 + PostgreSQL through `@prisma/adapter-pg` (`src/lib/db.ts`); config
  in `prisma.config.ts`; client generated to `src/generated/prisma` (gitignored).
  `prisma migrate dev` cannot run non-interactively here; create a migration
  with `npx prisma migrate diff --from-config-datasource --to-schema
  prisma/schema.prisma --script > prisma/migrations/<stamp>_<name>/migration.sql`,
  then `npx prisma migrate deploy && npx prisma generate`. Restart the dev
  server afterwards (it holds the old client).
- Plain CSS with tokens — `src/styles/tokens.css` is the only place colours,
  radii and motion values live. No Tailwind.
- Optional Resend (email); unset = emails printed to the server log. Optional
  cookieless analytics via `NEXT_PUBLIC_ANALYTICS_SRC` + `_SITE`.
- **No payment code.** Accounts are free pilots (`ALLOW_SIGNUPS=1` opens
  sign-up in production). A ported Stripe path was removed after review — read
  `claude-reports/Money-Safety/` before building billing.
- Node 22.14.0 (`.node-version`, render.yaml).

## Commands

```bash
cp .env.example .env     # set DATABASE_URL (local Postgres.app)
npm install              # postinstall runs prisma generate
npm run db:migrate       # prisma migrate dev (interactive only — see Stack)
npm run db:seed          # demo login (idempotent)
npm run dev              # http://localhost:3000
npm run lint && npm run typecheck
npm test                 # vitest: unit + integration against <db>_test on the same local server
npm run test:e2e         # playwright (installed Chrome) against a production build on :3211
npm run build
```

Tests derive their database from `.env` by appending `_test` and refuse a
non-local host (`tests/db-url.ts`). Create it once: `createdb profit_monitr_test`.

## Where things are

- `src/data/` — client-editable content: `landing.ts` (landing copy),
  `site.ts` (brand + `CONTACT`: founder, entity, email, scheduling link —
  rendered only when set), `sample.ts` (the fictional sample venue, verbatim
  from the handoff).
- `src/lib/dashboard/` — the dashboard contract (`types.ts`), the sample
  provider (`sample.ts`), the measured provider (`real.ts`), owner decisions
  (`mutations.ts`).
- `src/lib/destinations.ts` — where tracked links go: provider table,
  allow-list, `aff` for Eventbrite, website-verification gate.
- `src/lib/imports.ts` (+ `import-types.ts`, `csv.ts`) — platform order
  uploads: column aliases, parsing, attribution, idempotent upsert.
- `src/lib/signup.ts` — sign-up (closed in production unless `ALLOW_SIGNUPS=1`).
- `src/lib/bookings.ts` — booking on Monitr's page, door check-in, release.
- `src/lib/brief.ts` — the Monday brief's three actions.
- `src/lib/launch.ts` — what is still unset before outreach (`/api/health`).
- `src/components/landing/film/` — the hero film, ported 1:1 from the handoff.
- `src/components/brief/` — the public sample brief; `src/components/legal/` —
  privacy and pilot terms.

## Rules that are easy to break

- **Money is integer cents.** Dollar strings are parsed with `parseDollars`
  (string maths); imported amounts through `parseMoneyCell`; never `parseFloat`
  a bill, a price or an export cell.
- **Revenue is recognised when the money was taken**: at check-in for bookings
  made on Monitr's page (tables and tickets alike — a booking is a hold, not a
  sale), at `paidAt` for imported paid orders (the platform charged at
  purchase). Never show the two bases as one number without the split.
- **Imports are idempotent**: rows upsert on `(venueId, provider, externalId)`;
  a refund in a later file sets $0 and 0 tickets; a native booking is never
  touched by an upload; uploads never enter the live feed or the show rate.
- **Destinations are validated at write time** (`normalizeDestination`): https
  only, known platform hosts or the venue's website, never shorteners, never
  this app. A link to the venue's own site is live only when
  `Venue.websiteVerified` is true (operator sets it by SQL; README). Do not
  add a way for an owner to set it.
- **What a source can prove is labelled** (`ChannelRow.fidelity`): a
  clicks-only source never gets a conversion verdict, "Fix or cut", a rate, a
  return or a "pause it" action. Keep that true in every consumer.
- **Timestamps are timestamptz (UTC); calendar maths goes through
  `src/lib/time.ts`** with the venue's IANA zone. No `new Date().getDay()` for
  week or "today" logic. Export times are read as the venue's wall clock.
- **Gates are decided by the database**: conditional `updateMany` + row count
  (approvals, check-in, destinations), unique indexes (email, slug, codes,
  imported order ids), `SELECT … FOR UPDATE` (ticket capacity, call request).
  Never read-then-write.
- **Sample vs real is strict.** `Venue.sampleData = true` shows the handoff's
  sample venue untouched (every sample source is `fidelity: "exact"`); `false`
  shows only measured numbers. Don't blend them.
- **The demo account (`isDemo`) is read-only on the server** — its taps live in
  the browser so one visitor never changes what the next one sees.
- **No card fields anywhere.** Sign-up collects no payment data; don't add a
  field that posts any.
- Rate limits and click de-duplication key on `clientKey()` — never the
  left-most `X-Forwarded-For` hop, which the caller controls.
- Button/input font stack is `--font-ui` (no `system-ui`), body is `--font-sans`
  — it changes which font draws `→`, and the reference depends on it.
- Migrations: a migration is frozen once it has run anywhere real. New revision
  for every schema change.

## Not in the handoff (deliberate additions)

Overlay destinations and the Channels editor, platform order uploads and the
CSV export, the sample brief page, the legal pages, the first-week checklist,
public booking page `/book/<venue>`, tracked-link redirect `/r/<venue>/<slug>`,
door check-in `/app/door`, the sample-data notice and switch, "Log out", empty
states for real data. Listed with reasons in README → "Differences from the
handoff".

## Open questions for the client

See README → "Open questions". The big ones: nobody is charged yet (billing
unbuilt), the legal pages need counsel, the import column aliases need a real
pilot export, website verification is manual, the AI agents and "Ask the agent"
are not real agents, "Send the email" sends nothing.

## Working agreements

Global `~/.claude/CLAUDE.md` applies (rebase-before-PR, report-only audits →
`claude-reports/<Topic>/`, prove with a real run, commits only when asked and
never on `main`). Money-touching changes get the `money-safety-review` skill.
