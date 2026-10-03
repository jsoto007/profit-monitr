# Money-safety review: Profit Monitr initial build — 2026-10-03 — uncommitted working tree (`main`, no remote)

Scope: everything in the new app that moves or records money — subscription
billing at sign-up, ticket pricing and capacity, the door bill, revenue and ROI
figures on the dashboard, and the API surface around them.

Method: the build's own suite, then three independent review lenses run in
parallel (billing idempotency · payment maths · API authorization), each with
its own local database and its own executed tests, then fixes, then an
adversarial pass on the fixes. Every database used was on `localhost`.

## Verdict

- **Booking, check-in, ticket and revenue paths: safe to ship** as a
  *pay-at-the-door, no online payment* product, with the open items below.
- **Subscription billing: there is none.** The Stripe path ported from the
  earlier app was **removed**, not fixed (see "Stripe path"). Nobody is
  charged at sign-up; production sign-up is closed unless
  `ALLOW_DEMO_BILLING=1`. The app must not be described to the client as
  taking payment.

## Verified by execution

| What | Result | Command |
| --- | --- | --- |
| Unit + integration suite, local `profit_monitr_test` | **86 passed / 0 failed** | `npm test` |
| End-to-end, installed Chrome, production build (`next build` + `next start`), local test DB | **6 passed / 0 failed** | `npm run test:e2e` |
| Lint, typecheck | clean | `npm run lint`, `npm run typecheck` |
| Review lens — payment maths (before fixes) | 73 tests, each "BUG" test reproducing a finding | lens's own file, own DB |
| Review lens — authorization (before fixes) | 16 tests through the real route handlers | lens's own file, own DB |
| Review lens — billing (before removal) | 19 tests against a simulated Stripe | lens's own file, own DB |
| Adversarial pass on the fixes | 22 tests; 2 of 7 fixes held outright, 5 had a reproducible variant (below) | reviewer's own file, own DB |

Concurrency is tested by actually firing the operation concurrently:
same-email sign-up ×3 (one account), approval ×10 (one change), door scan ×8
(one arrival), last-ticket rush (never oversold), strategist request ×3 (one row).

Worked examples (integer cents), each asserted in `tests/integration/dashboard.test.ts`:

- Ticket order, $35.00 × 2 through a 10 %-off link: gross 7,000 → recorded
  `floor(7,000 × 90 / 100)` = **6,300**; revenue 0 until the door; at check-in
  6,300 is credited to that link, guests at the door +2.
- Odd cents: $33.33 × 1 at 15 % → `floor(3,333 × 85 / 100)` = **2,833** (the
  fraction of a cent goes to the guest); $9.99 × 3 at 33 % → **2,007**.
- Table of 4, bill typed `18450` by mistake then corrected to `184.50`:
  1,845,000 → **18,450**; one arrival; revenue per guest "$46".
- `184,50` (comma decimal) at the door: **refused**, never stored as 1,845,000.

## Not verified locally

- **Anything against Stripe** — no test keys on this machine. This is why the
  charging path was removed rather than repaired.
- **Render's proxy headers.** `clientKey()` prefers `cf-connecting-ip` /
  `true-client-ip`, else the right-most `X-Forwarded-For` hop. Which of these
  Render actually supplies was not observed; check once after the first deploy.
  Until then rate limits and click de-duplication may be too coarse or too
  loose there.
- **The Render deploy itself** — `render.yaml` was not synced; nothing was deployed.
- The door and booking screens on a physical phone (checked at 375 px in the
  browser pane and in Playwright only).

## Stripe path — removed

The ported design: browser confirms a SetupIntent → server writes a "pending"
account → creates customer + subscription with idempotency keys derived from
the payment-method id → deletes the account on any failure. The billing lens
reproduced (against a simulated Stripe that follows the documented idempotency
rules) these outcomes:

| # | Sev | Sequence → wrong outcome |
| --- | --- | --- |
| B1 | High | Charge succeeds, the following DB write fails, the account row is deleted → **$39.99/month collected with no account and no stored Stripe id**; only a log line |
| B2 | High | Same, then the customer reloads the page (the payment-method id lived only in browser memory) → new payment method → **second subscription** |
| B3 | High | After a failed attempt the user fixes a typo in name/email/venue → same idempotency key, different parameters → **permanent 502** from that tab |
| B4 | Med | A Stripe 5xx is replayed for the key on every retry; the only escape is the reload in B2 |
| B5 | Med | The client charges the first confirmed card even after the user enters a different one |
| B6 | Med | The stale-pending cleanup ran before validation and without auth |
| B7 | Med | `automatic_payment_methods` admitted delayed methods (ACH) → account active with $0 collected; no webhook to correct it |
| B8 | Med | First payment needing 3-D Secure reported as a declined card, forever |
| B10–13 | Low–Med | Config errors shown as "card declined"; unpaid subscription left alive; billing silently off if one of three env vars is missing; unauthenticated SetupIntent minting |

Because none of this could be run against Stripe, repairing it here would have
produced more unverified payment code. The path, its SDK dependencies and its
routes were deleted; sign-up is the handoff's no-charge prototype form.

**Recommended design when billing is built** (needs test keys and client
decisions on cancel / billing management): Stripe Checkout or a
customer-first flow — create the customer and store its id *before* any
charge; never delete a row that may have been charged; on retry look up the
customer's existing subscription and adopt it instead of creating another;
key idempotency on the account, not the payment method; cards only;
`off_session` and SCA handled; a signed webhook keeping
`subscriptionStatus` current (the access gate `hasAccess()` already exists).
Run it in test mode with 4242…, 4000 0025 0000 3155, 4000 0027 6000 3184 and
4000 0000 0000 0341 before any live key is set.

## Findings fixed in this build (each has a regression test)

| # | Sev | Finding | Fix |
| --- | --- | --- | --- |
| M-H1 | High | A table's bill could not be added or corrected after check-in, and the door list's button always sent an empty bill → revenue permanently 0, or a typo permanently 100× | `checkIn()` re-saves the bill for an arrived table without recording the arrival again; door rows load the code into the form ("Check in", "Add bill", "Edit bill") |
| M-H2 | High | `184,50` typed with a comma was stored as $18,450.00 | `parseDollars` accepts commas only as thousands separators; anything else is refused |
| M-H3 / A-F1 | High | An anonymous, unpaid ticket order counted as marketing revenue immediately, held capacity forever, and could be credited to any link (found independently by two lenses) | Revenue is recognised **at check-in** for every booking; max 10 tickets per order, whole numbers only; owner-only release frees un-arrived bookings; the shared demo venue refuses bookings |
| A-F2 | High | Rate limits keyed on the left-most `X-Forwarded-For` hop, which the caller writes | Key on the edge header or the right-most hop; added per-venue (bookings) and per-email (login) limits |
| A-F6 | High | A lapsed subscription kept access forever | Access allow-list (`active`, `trialing`, `past_due`, `demo`) enforced at login and on every request. Inert today (every venue is `demo`); it is the hook for real billing |
| A-F7 | High | Redirects kept the internal port and trusted `X-Forwarded-Host` | `absoluteUrl()` uses the configured origin; never the forwarded host |
| M4 | Med | "10 % off, applied automatically" was shown but not applied to the ticket total | Applied in integer cents, rounded down; the confirmation shows the exact amount owed |
| M5 | Med | A bill typed for a ticket order was accepted and discarded | Refused with a message |
| M6 | Med | Revenue per guest divided ticket money for a future night by tonight's door | Follows from revenue-at-check-in: both sides are now arrivals in the range |
| M7 | Med | ROI charged a link's weekly spend to weeks before it existed and compared a week in progress with a finished one | Spend counts only weeks the link existed and only the elapsed part of the current week; week-to-date is compared with the same stretch of last week |
| M9 | Med | "Tonight" reset at midnight mid-service | Live uses a service day (5 am → 5 am local) |
| M10 | Med | Activity during a stream gap was never delivered | The browser re-reads `/api/live` on every reconnect |
| M11 | Med | The Monday brief at 06:00 UTC reported the wrong week for Pacific-time venues | The endpoint handles each venue when it is Monday ≥ 06:00 locally; schedule it hourly |
| M12 | Med | A booking dated 9999-12-31 or Feb 31 was stored and broke the door list | Impossible and far-off dates are refused |
| A-F3 | Med | Every GET of a tracked link logged a click — crawlers and repeat taps flipped "Working" to "Not working" | HEAD and known bots are not counted; one click per visitor per link per 30 min |
| A-F4 | Med | The demo account could check parties in and show real names to the next visitor | Check-in/release refuse the demo; demo sessions last one day |
| A-F5 / B12 | Med | Sign-up was silently free when billing was not configured | Now explicit: closed in production unless `ALLOW_DEMO_BILLING=1` |
| A-F9 | Med | Unlimited live streams per user, each polling Postgres | Three per user; sample/demo venues do not poll the database |
| L13–L17, A-F10, A-F11, A-F13 | Low | Fractional quantities; int4 overflow; whole-dollar display where money is entered; tickets missing from "expected"; 500s on `null`/NUL bodies; demo-address squatting; one venue's failure aborting the weekly brief | All fixed |

## Open findings (not fixed — decisions or infrastructure)

| # | Sev | Finding | Why it is open |
| --- | --- | --- | --- |
| O1 | Med | Public bookings are unauthenticated: a hostile caller can still fill a night with held tickets (10 per order) or tables. No money is involved and the owner can release them, but it is manual | Needs payment at booking, a deposit, or email/SMS confirmation — product decisions |
| O2 | Med | Headline "Return on marketing" divides *all* traced revenue by paid spend, so free channels lift it | This is the design's own arithmetic ($48,920 ÷ $11,100 = 4.4×); changing it is a client call |
| O3 | Med | Account enumeration: `check-email` and the sign-up error reveal whether an address is registered | Product choice (friendlier form vs. privacy); login itself gives one uniform message |
| O4 | Low | Rate limits are in process memory | Fine for one Render instance; move to Postgres/Redis before scaling out |
| O5 | Low | "Traced to marketing", top source and arrivals-by-hour on Live refresh on reconnect, not per event | Cosmetic; totals are correct |
| O6 | Low | Bill corrections are last-write-wins with no audit trail | Add a `BillChange` log when staff accounts exist |
| O7 | Low | Marketing spend is a weekly figure on each link (API only); no real ad-spend import | No screen for it in the handoff |

## Adversarial pass

A fourth, independent reviewer was asked to refute that the fixes close the
High findings. Result: **no path was found where money that was never taken
shows as revenue** (dashboard ranges, Live, the stream, the browser's running
totals, the weekly brief — all read 0 for unpaid orders). The comma-decimal fix
and the Stripe removal held outright. Five fixes had a variant that still
failed or a side effect; all were then fixed, each with a test unless noted:

| # | What the reviewer reproduced | Resolution |
| --- | --- | --- |
| R1 | **Regression (would have been an outage):** the tightened same-origin check compared `Origin` only with the configured origin, so every write from a custom domain without `APP_URL` returned 403 | `Origin` must match the request's own `Host` or a configured origin; `X-Forwarded-Host` still ignored. Tested |
| R2 | The per-email login cap counted every attempt: ten wrong guesses by anyone locked the owner out for 15 minutes | Only failed attempts count (20 per 15 min) and a successful log-in clears them. Tested. A lock-out by a determined attacker is still possible — see O8 |
| R3 | The per-venue booking cap was spent by refused requests: 60 junk posts a minute closed a venue's booking page | The cap counts completed bookings only |
| R4 | A bill added or corrected after arrival never reached an open Live screen until the stream recycled | Live re-reads the server totals every minute and on every reconnect |
| R5 | Arriving on a tracked link and typing a different valid code: the link won and the typed code (and its discount) was dropped; an invalid typed code was accepted silently | A typed code wins and must be valid. Tested |
| R6 | A release overlapping a bill correction reported "bill set" on a booking that had just been deleted (198 of 200 forced overlaps) | The correction checks its row count and answers 404. Fixed by reading; the overlap itself is not in the suite |
| R7 | A held ticket order older than the newest 50 bookings could not be found in the door list, so the owner could not release it | The door list shows everything still to arrive first, and has search by code or name |
| R8 | The stream cap of three was shared by every visitor to the demo account, and an abandoned request held a slot for up to 15 minutes | Only database-polling streams are capped (five per user); sample and demo streams are not |
| R9 | The Monday email said "N guests came through your links" using every arrival | It counts guests credited to a link or code. Tested |
| R10 | A bill of the wrong JSON type was ignored and the table checked in at $0 | Refused. Tested |

Still open after the adversarial pass:

| # | Sev | Finding |
| --- | --- | --- |
| O8 | Med | **Rate-limit keys cannot be verified off Render.** `cf-connecting-ip` / `true-client-ip` are believed as sent; if Render's edge does not overwrite a client-supplied value, a caller can mint unlimited buckets. If neither header arrives, the right-most `X-Forwarded-For` hop is used, which behind two proxies puts every visitor in one bucket. Inspect the headers on the first deploy and pin `clientKey()` to the one Render writes |
| O9 | Low | Failed log-ins are capped per address, so 20 wrong guesses lock that address out for 15 minutes (existing sessions keep working). A better answer needs CAPTCHA or email unlock |
| O10 | Low | Concurrent bill corrections are last-write-wins (same as O6); a mistyped code that belongs to another arrived table overwrites that table's bill — the reply names the table |
| O11 | Low | `ALLOW_DEMO_BILLING=1` is set in `render.yaml`, so the blueprint deploys with free sign-up open. That is deliberate for a client demo; remove the line to close it |
