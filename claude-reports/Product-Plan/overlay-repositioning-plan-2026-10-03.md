# Overlay repositioning plan — 2026-10-03

**Scope.** Review of eight external recommendations for Profit Monitr (reposition as an attribution overlay, import ticket orders, trust layer, sample-brief CTA, venue wedge, legible economics, site analytics, operator interviews) plus two client notes: customers keep using what already works for them, and a real domain comes later. Output is a plan for the business model and the web app. **No code was changed.**

**Commit reviewed.** `origin/main` 762a87b; local branch `fix/mobile-edge-to-edge` 34dc4f4 (CSS only, PR #1 open). Not behind main.

**Method.** Code read with `file:line` evidence; nothing run against production. Draft plan written, then attacked by two independent reviewers (product/go-to-market lens; engineering lens with repo access). Third-party platform claims checked by web search; what could not be confirmed is marked unverified. Changes made after review are listed in §6.

---

## 1. Verdict

Adopt seven of the eight recommendations, re-word the eighth (economics), and change the order: **interviews and the first pilot run alongside the build, not after it.** The repositioning is right and the client has confirmed it, but it is not a copy change. Three facts from the code decide the plan:

1. **Every tracked link lands on Monitr's own booking page.** A channel has no destination field and the redirect always goes to `/book/<venue>` (`src/app/r/[venue]/[...path]/route.ts:26-29`, `prisma/schema.prisma:81-102`). The product today *is* the migration the recommendations argue against.
2. **The verdict and brief engine assume a booking follows a click.** A channel whose link goes to Posh or Resy never gets a Booking, so it reads "Not working" the moment it gets a click (`src/lib/dashboard/sample.ts:5-9` via `real.ts:104`), and the Monday brief's action #2 would tell the venue to pause its best link (`src/lib/brief.ts:27,37`). Overlay links without this fix produce a brief that is confidently wrong.
3. **Revenue is recognised at the door only** (`src/lib/dashboard/real.ts:23`, `revenueAt = checkedInAt`). Imported paid orders need their own recognition point or they are either $0 or counted as walk-ins.

Everything else (trust, CTA, economics, analytics) is small and should ship first, in the same week the interviews start.

---

## 2. Where the app stands against the recommendations

| # | Sev | Area | Finding (today) | Evidence | Fix (phase) |
| --- | --- | --- | --- | --- | --- |
| 1 | High | Positioning | Step 1 of "How it works" is "We set up reservations and ticketing — Native to your account"; hero footnote "Reservations set up for you"; pricing bullet 1 the same. `llms.txt` and the JSON-LD `featureList` carry the same pitch. | `src/data/landing.ts:18,33,83`; `public/llms.txt:3,11,25`; `src/app/page.tsx:23` | Copy (P0) |
| 2 | High | Links | No destination on Channel/Content; redirect hard-codes `/book/<venue>?via=`. Guests cannot be sent to the venue's Resy/Eventbrite/Posh page. | `route.ts:26-29`; `schema.prisma:81-121` | Schema + redirect (P1) |
| 3 | High | Brief engine | Verdict, "why", worst-channel line and brief actions are keyed on `door`/`clicks`; a clicks-only channel is "Not working", `best` is sorted by door so an external channel can never win, `rate = door/clicks` drives the sort. `ChannelRow` has no fidelity field. | `sample.ts:5-9`; `real.ts:103-120`; `brief.ts:26-39`; `src/lib/dashboard/types.ts:45-61` | Fidelity-aware engine (P1) |
| 4 | High | Revenue | Recognition is one line, at check-in; `door`, show-rate, no-show and the Live feed all key on `checkedInAt`; `res`/`tix` and Live select on `createdAt`. Imports have nowhere to land. | `real.ts:23,38-40,154-179,221-223,253` | `paidAt` + import semantics (P2) |
| 5 | High | Trust | Consent line "I agree to the Terms and authorize a recurring charge of $39.99 per month" links nowhere; nothing is charged; no `/terms` or `/privacy` route. | `src/components/auth/AuthScreen.tsx:291`; `src/app/*` | P0 |
| 6 | High | Trust | Sign-up step 3 collects a full card number, expiry and CVC in the browser and the server stores last4 — with no billing behind it. Production sign-up is open (`ALLOW_DEMO_BILLING: "1"`). | `src/lib/validation.ts:51-62`; `src/lib/signup.ts:47-50,66`; `src/lib/accounts.ts:19`; `render.yaml:43-44` | Drop the card step (P0) |
| 7 | Med | Trust | Demo email and password printed on the login page. | `AuthScreen.tsx:340` | Remove; "Explore the demo" already posts to `/api/auth/demo` (`Landing.tsx:157`) (P0) |
| 8 | Med | Trust | Brief card shows "The Copper Room · $48,920" with no label; only the AI-agents block says "Illustrative results". No founder, entity or contact email anywhere. | `landing.ts:48-61,72` | Label; facts from client (P0) |
| 9 | Med | Overclaim | AI-agents section ("#14 → #3", "6.8s → 1.2s"), pricing bullet "Website modernization, SEO & AI discovery" and "Expert guidance, included" describe work nobody does. | `landing.ts:64-73,87-88`; README open question 3 | Cut or mark roadmap (P0) |
| 10 | Med | Ops | Monday-brief cron is commented out in `render.yaml`; with `RESEND_API_KEY` unset the email is logged, not sent; the default sender is `onboarding@resend.dev`, which needs a verified domain for real recipients. **No pilot receives a Monday email today.** | `render.yaml:54-70`; `src/lib/email.ts:6-12` | Scheduler + domain + Resend (before pilots) |
| 11 | Med | Ops | Free Postgres expires 30 days after creation. | `render.yaml:7-8` | Paid tier before pilots |
| 12 | Low | Analytics | No analytics on the landing page. | grep for gtag/plausible/posthog/umami: none | Cookieless script via env (P0) |
| 13 | Low | Naming | Public name alternates "Profit Monitr" / "Monitr". `monitr.link` is a display host. | `src/data/site.ts`; README open question 8 | One name (P0); domain (client) |
| 14 | Low | Counting | Click de-dup is in-process memory; it resets on every deploy, so a redeploy mid-campaign overcounts repeat taps. | `src/lib/rate-limit.ts:3-7` | Accept for pilots; DB-backed later |

---

## 3. Verdict on each recommendation

**1. Overlay, not migration — adopt. It is the product change.** The tracked link points at the page the venue already uses; the native booking page stays as a fallback the site barely mentions. The model that fits the platforms: **per-channel destination = that platform's own tracking link for the promoter or campaign**, pasted by the venue; otherwise the venue's general booking URL.

Attribution fidelity by destination (shown in-product, never as "bookings"):

| Destination | What Monitr sees | Fidelity label | Confidence |
| --- | --- | --- | --- |
| Native page | click → booking → door | exact | code |
| Eventbrite | clicks here; sales per tracking link (`?aff=`) and promo code on their side, via export | platform-attributed (their last-click) | tracking links confirmed; per-order affiliate column in the CSV **unverified** |
| Posh | clicks here; tracking links report clicks/sales/revenue, promo codes per order, "Export Event Report" CSV | platform-attributed | links + promo codes confirmed; export columns **unverified** |
| OpenTable | clicks here; OpenTable marketing tracking links put Source and Campaign on each seated reservation in the reservations export | platform-attributed via import | per help-centre search snippet; page not fetched — **medium** |
| Resy | clicks here; Resy shows only coarse booking source | clicks (directional) | **unverified** |
| Partiful | ticketing with promo codes and CSV export launched June 2026 | platform-attributed, later | press release; **deferred** |

Restaurants on Resy get clicks plus a day-level clicks-versus-covers line from their reservation CSV, labelled "directional". **No door survey.** The draft's "how did you hear" quick-pick at the host stand was dropped after review: there is no create-at-door path (`checkIn` requires an existing confirmation, `src/lib/bookings.ts:124-133`), and a host with a Resy iPad and a line will not open a second app. Monitr's door screen stays for native and pay-at-door bookings only; for ticketed venues, attendance comes from the export's checked-in column.

**2. Import orders — adopt; Eventbrite and Posh, CSV first, built against the first pilot's real export.** Column mappers cannot be written from memory. Semantics (from the engineering review):
- New columns on Booking: `provider` (not `source` — that name already means something in `real.ts:206` and `checkin/route.ts:52`), `externalId`, `importedAt`, `paidAt`. Unique `(venueId, provider, externalId)`; import is an **upsert** (`ON CONFLICT DO UPDATE`) so a later export can zero a refunded row — insert-ignore would never see the refund.
- `revenueAt = paidAt ?? checkedInAt`. Imported paid orders: `paidAt` = purchase instant, revenue = ticket revenue net of refunds, before platform fees (fees shown separately if the export has them). Door tickets unchanged.
- `createdAt` = purchase instant (else every import floods the import week and "tonight"); `importedAt` keeps the audit trail. `date` = event start, parsed with `zonedTimeToUtc` in the venue zone (`src/lib/time.ts:43`). `confirmation` generated from provider + externalId.
- Events: upsert an `Event` per exported event (capacity unknown → 0, treated as unknown in Upcoming).
- Attribution: promo code → `Channel.code`; tracking-link/affiliate name → `Channel.slug`; unmatched → **"Platform / unattributed"**, not "direct" (most un-coded Eventbrite orders come from Eventbrite's own discovery).
- Money through `parseDollars` into integer cents; it rejects negatives and comma decimals (`src/lib/util.ts:88-95`), and Eventbrite exports contain negative refund lines, so the dry-run preview lists rejects before anything is written. Import route calls `assertNotDemo`.
- The brief shows two revenue lines: "Ticket sales (Posh/Eventbrite)" and "At the door". One number on two recognition bases was rejected in review.
- Money-affecting → `money-safety-review` before it ships. Webhooks later.

**3. Trust layer — adopt, with two changes from review.** (a) For pilots, a **one-page pilot agreement** (scope, data handling, deletion, duration, exit), emailed and acknowledged, replaces a "draft Terms" page — a visibly draft legal page is worse than none. `/privacy` is still needed (analytics, guest data). (b) **Founder name, legal entity and contact email gate the Phase 0 release**: a footer reading "[Founder name]" is worse than today's footer. Also: consent text rewritten to match reality; demo credentials removed; brief card labelled **"fictional sample venue"** with modest numbers (not just "sample numbers", and not relocated to Brooklyn — a fictional NYC venue doing $48,920 a week invites someone to check); the card step dropped (uses the existing `validateBilling(…, withCard=false)`, `src/lib/validation.ts:49-62`); one public name, "Profit Monitr".

*Domain.* The client's call, but the cost of waiting is now concrete: outreach links land on `onrender.com`, Resend cannot send Monday briefs to pilots without a verified sending domain (finding 10), and `monitr.link` stays fictional. It is the cheapest trust fix in this document.

**4. Sample brief as the main CTA — adopt, adjusted.** No real brief exists, so the interim is a public `/brief/sample` page rendered from the sample provider only, labelled fictional, **ending in the 15-minute-call CTA** — for three NYC pilots the call is the conversion. CTA ladder: "See a sample brief" (primary) → "Book a 15-minute call" → "Start a free pilot" with the line "Free during the pilot; $39.99/month after." The draft's "Start for $39.99 (demoted)" next to a no-card form was an inconsistency and is gone. Print-to-PDF styling deferred.

**5. Venue wedge first — adopt.** Hero tag leads with bars, clubs and event venues. The value over Posh/Shotgun's own promoter links must be stated plainly, because a Posh venue already has per-promoter links, promoter sales and a scanner: Monitr adds **one view across Instagram organic, promoters, email and paid, a Monday brief, and history** — not a door, which is redundant for them.

**6. Legible economics — adopt the intent, drop the wording.** "No per-ticket fee / we never touch the money" was rejected in review: under the overlay the venue still pays every Eventbrite/Posh fee, and a tracker that charges no ticket fee is not a feature ("neither does my spreadsheet"). Say: **"Flat $39.99. Your Posh, Eventbrite or Resy setup doesn't change."** Payout timing is not applicable. Guest/booking CSV export is cheap and real — build it, then list it.

**7. Instrument the site — adopt, smaller.** Cookieless analytics (Plausible or Umami, script URL from env) with UTM-tagged outreach links. The draft's "Monitr-on-Monitr case study" (own venue, `via` captured into `User.source`) is cut: it needs a migration and link rewriting (every CTA is a plain `<Link href="/signup">`, `Landing.tsx:176,183-184`, so `via` is dropped), would show clicks only (finding 3), and is a funnel of a few dozen clicks that no venue cares about.

**8. Ten operator interviews — adopt, and move to day 1.** Both reviewers flagged the draft's sequencing: copy shipped in week 1, interviews in week 4, rewrite in week 5. Interviews (Bronx and Brooklyn) and a 20-venue outreach list start the same day as Phase 0. Script: where guests book today; how promotions are tracked (codes, "how did you hear", nothing); who stands at the door; what they would do with a Monday brief; what they pay in ticketing fees; what they call it ("promoter nights", not "campaigns").

**Added by this review (not in the eight):**
- **A. Fidelity labelling** (above) — without it the overlay claim becomes the next overclaim.
- **B. The card form pre-launch** (finding 6).
- **C. Cut the AI-agents / SEO / "expert guidance" claims** (finding 9).
- **D. Activation checklist** at the end of onboarding, in this order: (1) swap your Instagram bio link to your tracked link — the real adoption ask; (2) paste your booking page / platform tracking links; (3) upload last month's orders (or check in Friday's guests if you book natively); (4) "Show my data" — `sampleData` defaults to true (`schema.prisma:66`), so a venue that skips this keeps looking at the fictional venue.
- **E. Open-redirect control** once links can point anywhere: https only, eTLD+1 allow-list of known platforms plus the venue's normalised website (`Venue.website` is a schemeless free string, `schema.prisma:49`), no userinfo, normalised at write time, HEAD uses the same destination, own `/api` and `/r` paths banned. Sign-up is open to anyone, so attacker-controlled venues are a given; the allow-list is what makes that safe.
- **F. Supersede the handoff.** `CLAUDE.md` names the handoff README as the source of truth for copy; without amending it, a later session will revert the overlay copy.
- **G. Pre-pilot ops**: schedule the brief (Render cron is a paid add-on; a free external scheduler hitting `/api/cron/weekly-brief` with `CRON_SECRET` works), set `RESEND_API_KEY` + `EMAIL_FROM` on the real domain, move Postgres off the free tier, decide whether open sign-up stays or pilots are invite-only.

---

## 4. The plan (revised after review)

Estimates are for a solo founder and were roughly doubled from the draft on the engineering reviewer's evidence.

**Day 1, in parallel with everything below — interviews and outreach list.** Ten operator interviews; a 20-venue list; the first Posh or Eventbrite venue identified as pilot #1. Their real export is what Phase 2 is built against.

**Phase 0 — copy, trust, CTA (3–4 days, no schema change).**
- Amend `CLAUDE.md` (handoff superseded for positioning copy) and README.
- Copy: hero, "How it works", pricing bullets, `SITE.description`, `llms.txt`, JSON-LD features; name the platforms ("points to the booking page you already use" — never "integrates with"); one name; "fictional sample venue" labels; cut agents/SEO/expert claims.
- Sign-up: step 3 becomes "Pilot terms" (no card) — `signup.ts`, `accounts.ts` (`cardLast4` optional), `AuthScreen.tsx` copy at :17-18, :159, :285-291, :316, :340; consent links to the pilot agreement and `/privacy`.
- `/privacy` route; pilot agreement as a page or PDF (content from client/counsel).
- Footer: founder, entity, contact — **gates the release**.
- `/brief/sample` from the sample provider, ending in the call CTA; CTA ladder as in §3.4.
- Cookieless analytics via env.
- Tests to update: `tests/integration/accounts.test.ts:61-83` (three card tests), `e2e/smoke.spec.ts:28-33,30,44-45,81-99,157`.
- Needs from client before shipping: founder facts, scheduling link, pilot-agreement text, domain decision.

**Phase 1 — overlay links and a fidelity-aware engine (1.5–2 weeks). Pilot #1 goes live at the end of this phase.**
- Migration: `Venue.bookingUrl`, `Venue.bookingProvider`, `Channel.destination?` (Content-level deferred).
- Redirect: `channel.destination ?? venue.bookingUrl ?? native page`, with the allow-list from §3.E; Eventbrite destinations get `aff=<channel.slug>` appended when no per-channel link is pasted.
- Onboarding step 2: "Where do guests book today?" (Resy / OpenTable / Eventbrite / Posh / own site / not yet) + URL. A settings endpoint and UI for per-channel destinations (today `PATCH /api/venue` only toggles `sampleData`).
- `ChannelRow.fidelity`; verdict/why/worst/brief skip clicks-only channels or use a clicks-based verdict ("Getting clicks" / "Few clicks"); `rate` and ROI render "—" for them; sample output unchanged.
- Activation checklist (§3.D).
- Pilot #1 runs on this alone: their tracked links, their promo codes, a brief that is honest about clicks.

**Phase 2 — imports and export (2 weeks, including the money-safety review).**
- Migration: `Booking.provider`, `externalId`, `importedAt`, `paidAt`, unique index; `Event` upsert.
- CSV import for pilot #1's platform first, the second platform when pilot #2 arrives; column mapping per provider, dry-run preview with rejects, upsert semantics, refunds → $0, venue-zone timestamps.
- Engine: `revenueAt = paidAt ?? checkedInAt`; two revenue lines in the brief; "Platform / unattributed" bucket; Live feed skips imported rows.
- One-click bookings/guests CSV export; then list it on the pricing card.
- `money-safety-review` with a real import run and an adversarial pass.

**Weeks 5–8 — pilots.** Three NYC venues live; each reaches four consecutive Monday briefs with at least one real source; the first redacted real brief replaces the sample; then wider outreach.

**Deferred until pilots ask:** Content-level destinations, Partiful, print-PDF styles, any door quick-pick, webhooks, password reset, native paid tickets (Stripe, fees, payouts — this would make Monitr a booking system again; it stays off the roadmap until a pilot demands it), subscription billing.

---

## 5. Business-plan model updates

- **Positioning.** "Attribution that sits on top of what you already use." Not a booking system; the native page is a fallback.
- **ICP.** Bars, clubs and event venues running promoter nights, NYC first; Resy/OpenTable restaurants second, sold on clicks and OpenTable's own source export.
- **Pricing.** $39.99 flat, free during the pilot; the venue's platform fees are unchanged; export included once built.
- **Go-to-market.** Interviews first; three instrumented pilots before wider outreach; sample brief as lead magnet; 15-minute call as the conversion; a real domain before outreach.
- **KPIs (measurable, not activity).** Pilots reaching four consecutive briefs with ≥1 real source; share of a venue's guests that is attributable; brief actions marked done; week-4 retention; pilot → paying. Dropped: links created, raw clicks, email opens (unreliable under Apple Mail Privacy Protection).
- **Risks.** Resy data gap (mitigated by the venue wedge; restaurants get "directional"); CSV friction (dry-run, webhooks later); trust before a domain (Phase 0 plus the domain decision); solo-founder bandwidth (Phase 2 only after pilot #1 is live).

---

## 6. Peer review — what changed

Two independent reviewers attacked the draft. Accepted and folded in:

| Objection | From | Change |
| --- | --- | --- |
| Interviews after the build means rewriting the copy twice | product | Interviews and outreach list moved to day 1; pilot #1 goes live after Phase 1, Phase 2 built on their export |
| Resy/OpenTable "door survey" loop is unworkable; no create-at-door path exists | both | Dropped. Restaurants get clicks + directional CSV line; door UI stays for native/pay-at-door |
| Clicks-only channels read "Not working" and the brief says "pause" | engineering | Fidelity field and engine changes made a Phase 1 requirement, not "dashboard wording" |
| Revenue at purchase cannot be expressed with the draft's columns | engineering | `paidAt`, `createdAt` = purchase instant, Event upsert, upsert-on-conflict for refunds, two revenue lines |
| "No per-ticket fee" undercuts the story | product | Replaced with "Flat $39.99. Your setup doesn't change." |
| Door is redundant for Posh/Eventbrite venues | product | Attendance from the export; door not sold to the wedge |
| "Not a booking system" vs native paid tickets on the roadmap | product | Native paid tickets struck until a pilot demands it |
| CTA/price inconsistency after removing the card | product | "Start a free pilot" + "$39.99/month after"; sample page ends in the call CTA |
| Draft Terms page and placeholder footer are worse than none | product | Pilot agreement instead; founder facts gate the release |
| Unmatched imports as "direct" would crown the wrong channel | product | "Platform / unattributed" |
| KPIs were activity metrics | product | Replaced (§5) |
| Monitr-on-Monitr case study needs a migration and shows clicks only | both | Cut; Plausible + UTMs |
| `source` name collides with existing helpers | engineering | `provider` |
| Handoff README is the copy source of truth per CLAUDE.md | engineering | Phase 0 amends CLAUDE.md |
| Phase 0 is not "copy only"; tests and server code change | engineering | Listed in §4 with file references |
| Estimates too low | both | Roughly doubled |
| Brooklyn relocation of a fictional $48,920/week venue | product | Not relocated; labelled fictional, modest numbers |

Refuted or corrected after checking:
- Product reviewer: "Resy/OpenTable have no per-link passthrough (high confidence)." **Partly wrong for OpenTable** — its marketing tracking links put Source and Campaign on seated reservations in the export (help-centre snippet; page not fetched, so medium confidence). Resy stays unverified.
- Product reviewer: "Partiful added paid tickets in 2024–25 (low confidence)." **Corrected**: Partiful launched ticketing with promo codes, Stripe payouts and QR check-in in June 2026 (press release). Still deferred.
- Product reviewer: "Eventbrite Affiliate column in the orders export (high confidence)." **Could not confirm** from Eventbrite's help pages; tracking links and `?aff=` are confirmed. Marked unverified; check with pilot #1's export.

Open (could not assess): Posh export columns; whether "The Copper Room" collides with a real NYC venue; the client's weekly hours; whether Resy exports a per-row source.

---

## 7. Verified vs not verified

**Verified (code, `file:line` above).** Every row of §2; `validateBilling(withCard=false)` exists; `POST /api/auth/demo` exists; only the init migration exists, so all schema changes are new revisions (CLAUDE.md rule respected); same-origin check applies to writes only; `Referrer-Policy` already `strict-origin-when-cross-origin`.

**Verified (web, 2026-10-03).** Eventbrite promotional tracking links with `?aff=` ([help article](https://www.eventbrite.com/help/en-us/articles/835126/how-to-create-promotional-tracking-links/)); Posh tracking links report clicks, ticket sales and revenue, promo codes exist, "Export Event Report" CSV with selectable fields ([tracking links](https://support.posh.vip/en/articles/10723750-creating-tracking-links), [promo codes](https://support.posh.vip/en/articles/10723713-boost-your-sales-with-promo-codes), [export](https://support.posh.vip/en/articles/10723748-export-your-event-data) — fetched pages returned 404, snippets only); Partiful ticketing launch June 2026 ([PR Newswire](https://www.prnewswire.com/news-releases/partiful-launches-ticketing-bringing-paid-events-into-the-social-platform-where-people-already-make-plans-302789410.html)).

**Not verified.** Eventbrite per-order affiliate/promo columns in the CSV; Posh export columns; OpenTable marketing tracking links and export columns ([help article](https://support.opentable.com/s/article/Know-your-digital-marketing-ROI?language=en_US) did not render); Resy source data; Partiful export fields; Shotgun promoter links. All are to be checked against a real export from pilot #1 before Phase 2 is designed in detail.

---

## 8. Recommended next steps (ranked)

| # | Step | Effort | Needs from client |
| --- | --- | --- | --- |
| 1 | Decide the domain now vs later, knowing it blocks Monday emails to pilots and outreach links | — | decision |
| 2 | Start interviews + 20-venue list; identify pilot #1 (Posh or Eventbrite) | ops | time |
| 3 | Phase 0 | S (3–4 d) | founder facts, scheduling link, pilot-agreement text |
| 4 | Pre-pilot ops: scheduler for the brief, Resend on the domain, paid Postgres, sign-up policy | S | Render actions need explicit OK |
| 5 | Phase 1; pilot #1 live | M (1.5–2 w) | pilot's platform links |
| 6 | Phase 2 against pilot #1's export; money-safety review | M–L (2 w) | a real export |
| 7 | Pilots #2–3; four briefs each; redacted real brief replaces the sample | ops | — |

**Decisions only the client can make:** domain timing; founder/entity/contact facts; pilot duration and agreement text; keep open sign-up or invite-only pilots; cut the AI-agents section or keep it as "roadmap"; sample venue stays fictional (recommended) or is replaced by pilot #1's redacted data later.

---

## Appendix

**Commands run (read-only).** `git status/log/fetch`, `grep` across `src/`, `prisma/`, `public/`, `README.md`, `CLAUDE.md`; web searches listed in §7. No tests, servers, migrations or production calls.

**Earlier report built on.** `claude-reports/Money-Safety/money-safety-review-2026-10-03.md` (why there is no payment code; its recommended billing design still applies when charging starts).

**Draft superseded.** The pre-review draft is in the session scratchpad only; this file is the plan.
