# Profit Monitr

$39.99/month SaaS for restaurants, bars and venues: tracked links and promo
codes per influencer/promoter/campaign, click → booking → door check-in →
revenue attribution, a Monday brief with three ranked actions, AI-agent website
recommendations. Three screens: landing (`/`), sign-up / log-in (`/signup`,
`/login`) and the seven-section app (`/app`).

Built from the design handoff at `~/Downloads/design_handoff_profit_monitr`
(mirrored read-only in `docs/design-handoff/`). **That README is the source of
truth for look, copy and interactions**; the `.dc.html` files are the pixel
reference. README.md here has the route table, API, env vars and deploy steps.

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
- Plain CSS with tokens — `src/styles/tokens.css` is the only place colours,
  radii and motion values live. No Tailwind.
- Optional Resend (email); unset = emails printed to the server log.
- **No payment code.** Billing is the handoff's no-charge prototype form. A
  ported Stripe path was removed after review — read
  `claude-reports/Money-Safety/` before building billing.
- Node 22.14.0 (`.node-version`, render.yaml).

## Commands

```bash
cp .env.example .env     # set DATABASE_URL (local Postgres.app)
npm install              # postinstall runs prisma generate
npm run db:migrate       # prisma migrate dev
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
  `site.ts` (brand), `sample.ts` (the sample venue, verbatim from the handoff).
- `src/lib/dashboard/` — the dashboard contract (`types.ts`), the sample
  provider (`sample.ts`), the measured provider (`real.ts`), owner decisions
  (`mutations.ts`).
- `src/lib/signup.ts` — sign-up (closed in production unless
  `ALLOW_DEMO_BILLING=1`).
- `src/lib/bookings.ts` — public booking, door check-in, release.
- `src/components/landing/film/` — the hero film, ported 1:1 from the handoff.

## Rules that are easy to break

- **Money is integer cents.** Dollar strings are parsed with `parseDollars`
  (string maths); never `parseFloat` a bill or a price.
- **Timestamps are timestamptz (UTC); calendar maths goes through
  `src/lib/time.ts`** with the venue's IANA zone. No `new Date().getDay()` for
  week or "today" logic.
- **Gates are decided by the database**: conditional `updateMany` + row count
  (approvals, check-in), unique indexes (email, slug, codes), `SELECT … FOR
  UPDATE` (ticket capacity, expert request). Never read-then-write.
- **Sample vs real is strict.** `Venue.sampleData = true` shows the handoff's
  sample venue untouched; `false` shows only measured numbers. Don't blend them.
- **The demo account (`isDemo`) is read-only on the server** — its taps live in
  the browser so one visitor never changes what the next one sees.
- The card number, expiry and CVC never leave the browser. Don't add a field
  that posts them.
- **Revenue is recognised at check-in**, for tables and tickets alike. A
  booking is a hold, not a sale.
- Rate limits and click de-duplication key on `clientKey()` — never the
  left-most `X-Forwarded-For` hop, which the caller controls.
- Button/input font stack is `--font-ui` (no `system-ui`), body is `--font-sans`
  — it changes which font draws `→`, and the reference depends on it.
- Migrations: the init migration is frozen once this deploys. New revision for
  every schema change.

## Not in the handoff (deliberate additions)

Public booking page `/book/<venue>`, tracked-link redirect `/r/<venue>/<slug>`,
door check-in `/app/door` (linked from Live → Activity), the sample-data notice
and switch, "Log out", empty states for real data. Listed with reasons in
README → "Differences from the handoff".

## Open questions for the client

See README → "Open questions". The big ones: nobody is charged yet (billing,
webhooks and the cancel flow are unbuilt), the AI agents and "Ask the agent"
are not real agents, no link-management screen, "Send the email" sends
nothing, Terms page missing.

## Working agreements

Global `~/.claude/CLAUDE.md` applies (rebase-before-PR, report-only audits →
`claude-reports/<Topic>/`, prove with a real run, commits only when asked and
never on `main`). Money-touching changes get the `money-safety-review` skill.
