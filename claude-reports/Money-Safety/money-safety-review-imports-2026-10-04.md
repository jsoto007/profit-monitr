# Money-safety review: platform order imports and export — 2026-10-04 — branch `feat/overlay-attribution`

**Change.** Phase 2 of the overlay repositioning (commit 334caec, fixes on top): a venue uploads its Posh / Eventbrite / OpenTable export, orders are credited to the code or link that earned them, revenue is recognised when the platform took the money (`paidAt`), and every booking can be exported as CSV. Money-affecting, so this review was mandatory before "done".

**Method.** The suite was run before and after the fixes. Three independent reviewers (payment math + data/migration; idempotency + concurrency + authorization; client + brief + notifications) each returned concrete failure scenarios, two of them reproduced with throwaway scripts against the local test database. Every High finding was fixed and the fix is covered by a test; refuted or accepted items are listed below.

## Verified by execution

- `npm test` — 109 passed (7 files), against `localhost/profit_monitr_test`.
- `npm run test:e2e` — 6 passed: upload through the UI (file chooser → preview → import), the revenue split on the Revenue tab, the CSV export, the attribution loop with a destination round-trip.
- Lint and typecheck clean.
- Reviewer probes (reproduced, not just read): `parseMoneyCell` on 25 cell shapes; Prisma 7.10 `upsert` on the compound unique emits a single native `INSERT … ON CONFLICT DO UPDATE` (SQL logged); same file uploaded twice and five times concurrently → one row per order; a deadlock between two differently ordered concurrent uploads (fixed, see below); a 30,000-row file timing out the default 5 s transaction (fixed); Postgres treats NULL `externalId` as distinct in the unique index.
- Worked example (integration test "credits each order…"): four Eventbrite orders — $60 INSTA, $40 via affiliate `email`, $25 no code, $15 refunded — → credited revenue $100.00, platform $100.00, door $0, unattributed $25.00, tickets 4 (the refund holds none); re-upload → created 0 / updated 4, totals unchanged; a later file refunding the $60 order → credited $40.00; the old file uploaded again → `keptRefunded 1`, still $40.00; the brief then names Email (1 booking on Eventbrite, $40) as the best source.

## Not verified locally

- Real Posh / Eventbrite / OpenTable exports: none exist in the repo. Column aliases and status vocabulary ("Partially Refunded", "Unpaid", "Completed") are from the platforms' documentation; the dry-run preview names unmatched columns, and README → "Open questions" says the first pilot's file decides.
- Transaction timing on Render's networked Postgres (local: ~0.3 ms per upsert; the 5,000-row cap keeps a commit well inside the 60 s timeout even at 2 ms).
- Excel/Sheets opening the export (the formula guard is verified on the emitted bytes).

## Findings (survived the adversarial reading) and what was done

| Sev | Finding | Fix |
| --- | --- | --- |
| High | Any status containing "refund" zeroed the whole order: a $60 order with a $5 partial refund became $0 and 0 tickets | Lines for the same order are netted; "partial" never zeroes; only a full refund/cancel does. Test: `nets a partial refund…` |
| High | "Completed" status (Eventbrite's normal paid status) and "Seated" were read as attendance and stamped at the event date — in the future — so `door`, `revPerGuest` and the brief's "guests through the door" counted a night that had not happened | Platform attendance is no longer written as a door check-in at all; it is counted in the preview only. Door, show rate, revenue per guest and the Live screen are Monitr's own measurements. Tests: `!!r.checkedInAt` false for a "Yes" row; OpenTable `attended` null |
| High | Export CSV had no formula-injection guard: a guest name `=HYPERLINK(...)` typed on the public booking page opens as a formula | `csvCell` prefixes text starting with `= + - @ \t \r` with `'`. Test: `neutralises spreadsheet formulas` |
| High (client) | Imported orders appeared in the door list with untypeable confirmations; "Release" would have hard-deleted a paid platform order; a re-upload would have wiped a door bill | Check-in, release and the door list are native-only (`provider: "native"`); imported rows cannot be worked at the door. Test: 404 on check-in and release of an imported row |
| Medium | Two concurrent uploads for one venue with different row order deadlocked (P2034 → 500) | The transaction takes `SELECT … FOR UPDATE` on the venue row first and re-reads what exists inside it; uploads serialise and the history records exact `created`/`updated` |
| Medium | A 2 MB file could exceed the default 5 s transaction timeout (30,000 rows locally) with a clean rollback and a 500 | Row cap 5,000 (413 "export one month at a time"), transaction timeout 60 s, request `Content-Length` refused above 2.6 MB before parsing |
| Medium | An older export uploaded after a newer one un-refunded orders | A refunded row stays refunded whatever an older file says (`keptRefunded` in the preview); UI copy says to upload in date order |
| Medium | Unpaid / pending / abandoned orders counted as paid revenue at order time | Status in `unpaid|pending|abandoned|…` → a hold: amount kept, no `paidAt`, never revenue; shown in the preview |
| Medium | A timestamp with a trailing "UTC"/"GMT" or an unknown zone token was read as venue wall clock and could cross the Monday boundary | "UTC"/"GMT"/"Z" are applied; any other trailing token rejects the line instead of guessing |
| Medium | Quantity stripped every non-digit ("2.5" → 25, "4 (2 kids)" → 42) | Strict: digits only after an optional unit word; otherwise the line is skipped with a reason |
| Medium | Refunded / cancelled rows still counted as reservations, tickets and orders | Rows holding nothing (imported, `partySize 0`) are excluded from `res`, `tix`, `orders` and bookings-by-day |
| Medium | Fidelity flipped by range and by any provider's upload; a native-destination channel credited from a Posh file stayed "exact" | Fidelity is "platform" when the channel has imported orders in the range, or its link lands on a platform the venue has uploaded from; "clicks" only for a platform never uploaded from |
| Medium | Native and imported events with the same name duplicated "Coming up"; the same night exported with two date formats split in two | An un-id'd imported event is matched to a native event of the same name within 12 h; the fallback id uses the parsed start, not the raw text |
| Medium | Brief ignored platform bookings (best by door only; "Fix or pause" paired an order rate with "guests") | Best source ranks by door, or by platform bookings; descriptions say "bookings on Posh … click-to-order"; the email opener names both bases |
| Low | "Free", "Comp" cells rejected whole rows; foreign currencies read as dollars | Free words → $0 (a guest, no money); `£ € ¥ EUR GBP CAD …` reject the line as "US dollars only" |
| Low | Confirmation truncated at 180 chars could collide and abort an upload | No truncation; order ids over 120 chars are skipped with a reason |
| Low | Export silently truncated at 10,000 rows; ISO columns unlabelled | Cap 50,000 with a final line saying so; headers say "(UTC)" |
| Low | Imported events (capacity 0) appeared "Sold out" on Monitr's booking page | Imported events are excluded from `/book/<venue>` |
| Low | Upload history vanished on tab switch; file input never reset; `revPerGuest` mixed platform money with door guests; "0 bookings · 0 in" for clicks-only sources | History comes from `/api/imports` after each upload; input reset; `revPerGuest` = door sales ÷ door guests; clicks-only sources omitted from "Where bookings came from" |

**Refuted / accepted after review.**
- "Both concurrent inserts fail with P2002": refuted — Prisma emits native `ON CONFLICT DO UPDATE`; the real problem was lock order (fixed).
- OpenTable `Source=Google` crediting a venue's "Google" channel: accepted — that is the Google Business profile source, the attribution is correct, no money is involved.
- `money()` rounds split lines to whole dollars independently of the headline: accepted — the headline, platform and door figures are each rounded from exact cents; a half-dollar discrepancy in the email is cosmetic and the export carries exact cents.
- D/M/Y dates read as M/D/Y: accepted for US pilots; documented.
- A header-only or all-rejected commit writes no Import record: accepted — the UI disables the import button at 0 rows.

## Verdict

**SAFE TO SHIP for the pilot**, given what was verified: integer-cents maths with no float on the path, idempotent upserts proven by execution, refunds that stick, revenue recognised only when the platform took the money, imported rows unreachable from the door, concurrent uploads serialised, and the export neutralised against formula injection. The one open item is outside the code: the column aliases must be checked against the first pilot's real export (the preview will show what is missing before anything is written).
