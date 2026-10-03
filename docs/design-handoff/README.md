# Handoff: Profit Monitr — marketing site, sign-up and growth command center

## Overview
Profit Monitr is a $39.99/month SaaS for restaurants, bars and venues. It sets the venue up with native reservations and ticketing, gives every influencer / promoter / campaign a unique link and promo code, traces clicks → bookings → guests at the door → revenue, and sends a plain-language **weekly brief** every Monday (what happened → why → what made money → what to do next). AI agents keep the venue's website fast, found by Google and AI assistants, and queue recommendations the owner approves one by one. Expert guidance is included.

Main message: **"Don't just track likes. Track what drives sales and reservations."**

This package covers three screens that together form the product:
1. **Landing page** (`Profit Monitr Landing v2.dc.html`)
2. **Sign-up / log-in** (`Monitr Signup.dc.html`)
3. **The app / dashboard** (`Monitr App.dc.html`) — seven sections behind a sidebar.

## About the design files
The `.dc.html` files are **design references built in HTML** — interactive prototypes showing intended look and behaviour. They are not production code. Recreate them in the target codebase's environment (Next.js/React recommended if nothing exists yet; Tailwind or CSS modules are both fine) using its established patterns. Open any `.dc.html` in a browser (with `support.js` beside it) to see the real thing, inspect spacing, and click through the interactions.

The hero animation ("Likes Not Sales", a 21-second loop) is implemented in `likes-piece.jsx` + `likes-parts.jsx` on a small timeline engine (`animations-v3.jsx`). Port the composition to Framer Motion / GSAP / CSS keyframes, or export it as an MP4/WebM and embed as a muted looping `<video>`. Either is acceptable.

## Fidelity
**High-fidelity.** Colours, type, radii, spacing and copy are final. Recreate pixel-close.

---

## Design tokens

### Colour
| Token | Hex | Use |
|---|---|---|
| ink | `#111111` | text, frame, primary buttons, dark cards |
| paper | `#FFFFFF` | canvas |
| canvas-alt | `#F4F4F2` | light grey sections and pods |
| hairline | `#ECECEA` | 1.5px card borders, dividers |
| text-muted | `#555555` / `#666666` | body copy / labels |
| text-faint | `#888888` / `#999999` | captions, timestamps |
| mint | `#C9F2DC` | positive, revenue, success, highlight pill |
| mint-ink | `#2E5A44` | text on mint |
| lavender | `#E3DCFF` | "why", reservations, pricing pod |
| lavender-ink | `#4A3F80` | text on lavender |
| butter | `#FFE7A3` | third promise pod |
| butter-ink | `#6B5300` | text on butter |
| live-green | `#2ECC71` | live dot only |
| error | `#C0392B` | validation copy and borders |
| brand-gold | `#B68235` | logo mark (fourth square) on light |
| brand-gold-reverse | `#E1AD66` | logo mark on dark |
| dark-glass | `rgba(255,255,255,.08)` | rows inside dark cards |

### Type
- Family: **Figtree** (Google Fonts), weights 400/500/600/700/800. Fallback `system-ui, sans-serif`.
- Display h1: `clamp(42px, 5.6vw, 80px)`, 800, line-height 0.98, letter-spacing −0.04em.
- Section h2: `clamp(34px, 4vw, 56px)`, 800, lh 1, ls −0.035em.
- Screen h1 inside the app: `clamp(34px, 3.6vw, 48px)`, 800, lh 1.02, ls −0.035em.
- Card title: 20–24px, 800, ls −0.02em.
- KPI number: 40–44px, 800, lh 1, ls −0.04em, `font-feature-settings: 'tnum' 1`.
- Body: 15–17px, 400, lh 1.5–1.55, `#555`.
- Label / kicker: 13px, 600, `#666`, uppercase with `.04em` tracking.
- Buttons: 14–15px, 600.
- `text-wrap: pretty` on body.

### Shape & space
- Page frame: body `#111`, 16px padding, white canvas `border-radius: 36px` (landing) / `32px` (app main).
- Pods / cards: radius **28px** (28–32px for large), KPI cards **22px**, rows inside dark cards **16–20px**, inputs **14px**, pills/buttons **999px**.
- Card border: `1.5px solid #ECECEA`. No shadows except the phone (`0 30px 60px -20px rgba(17,17,17,.45)`).
- Section padding: `clamp(64px, 8vw, 112px)` vertical, `clamp(20px, 4vw, 40px)` horizontal, content max-width 1240px.
- Grid gaps: 14px between cards, 16px between pods, 36px between app sections.

### Buttons
- Primary: bg `#111`, text `#fff`, radius 999px, padding 16px 24px (large) / 13px 18px (small), 600.
- Secondary: bg `#fff`, `1.5px solid #111`, same radius/padding minus the border.
- Ghost text link: 600, `#C9F2DC` on dark.
- Focus: `outline: 2px solid #111; outline-offset: 2px`.
- Segmented control: container `#F4F4F2` radius 999px padding 4px; active segment bg `#111` text `#fff`; inactive transparent text `#111`; segment padding 9px 14px, 13px/600.

### Logo
`assets/logo/` — three outlined squares (2.5px stroke) with a filled gold fourth square. Use `profit-monitr-mark.svg` on light (ink `#201F1D`, gold `#B68235`) and `profit-monitr-mark-reverse.svg` on dark (paper stroke, gold `#E1AD66`). In the UI the mark is 28–30px with the wordmark "Profit Monitr" at 18–21px/800, ls −0.03em, gap 10px. Lockups, mono, gold and favicon variants are included.

---

## Screen 1 — Landing (`Profit Monitr Landing v2.dc.html`)

**Frame:** sticky header inside the white canvas (bg `rgba(255,255,255,.92)` + `backdrop-filter: blur(10px)`, bottom border 1.5px `#ECECEA`). Header: logo + wordmark left; links "How it works · Weekly brief · AI agents · Pricing" (15px/500 `#555`, hidden under 960px); right: "Log in" (secondary pill) and "Start · $39.99/mo" (primary pill). Nothing in the header wraps.

**Sections, in order**
1. **Hero** — two columns `minmax(0,1.25fr) auto`, gap `clamp(28px,5vw,80px)`.
   - Left: pill tag with live-green dot "For restaurants, bars & venues" (13px/600 on `#F4F4F2`); h1 "Don't just track likes. Track what drives **sales** and **reservations**." — "sales" sits on a mint pill, "reservations" on a lavender pill (`display:inline-block; line-height:1; padding:2px 12px 6px; radius 16px`); paragraph; buttons "Start for $39.99 a month" (primary) and "See how it works" (secondary); footnote "Everything included · Reservations set up for you · Cancel anytime".
   - Right: phone bezel `width: clamp(230px, 26vw, 330px)`, aspect 9/16, bg `#111`, radius 40px, padding 10px, inner screen radius 31px, white. The animation fills the screen, loops, no controls. Caption under it: "LIKES DON'T PAY THE RENT · 21 S" (12px/600, `.06em`, `#888`).
2. **Three promises** — three pods (mint / lavender / butter), radius 28px, padding 28px; "01/02/03" kicker (13px/600 in the pod's ink colour), 44px gap, 24px/800 title, 15px body in the pod's ink colour. Copy:
   - 01 *Every booking traced to its source* — A unique link and promo code for each influencer, promoter and campaign — credited all the way to the door.
   - 02 *One brief, every Monday* — What happened, why, what made money and the three moves worth making this week — from your own data.
   - 03 *Your website, optimized for free* — AI agents keep your site fast and found — by Google and by AI assistants — and ask before they change anything.
3. **How it works** (`#how`, bg `#F4F4F2`) — kicker HOW IT WORKS, h2 "From the first click to the front door.", right-aligned intro "No spreadsheets, no guessing. Three steps and you know which marketing fills the room." Three white cards, each with a 40px black numbered circle, 22px/800 title, 15px body:
   1. *We set up reservations and ticketing* — Native to your account, so every table and ticket is yours — your availability, your prices, your guest data.
   2. *You share links and codes* — One for every influencer, promoter and campaign. Clicks, bookings, ticket sales and check-ins are credited to whoever earned them.
   3. *Monday, you read the brief and act* — One page in plain language. Three recommendations ranked by what they're worth, with a strategist a click away.
4. **The weekly brief** (`#brief`) — left: kicker, h2 "A brief, not a dashboard.", paragraph, three bordered rows (Personal to your venue / Actionable / Expert guidance with muted right-hand notes). Right: dark card (`#111`, radius 32px, padding 28px): meta row "The Copper Room · Sep 21–27" with mint "+18%" pill; headline "Your marketing made $48,920 in sales. One Saturday reel did most of the work." (clamp 26–34px/800); 7 pill bars (`max-width: 28px`, `justify-content: space-between`, heights 20/16/28/45/78/100/35 %, Sat bar mint, others `rgba(255,255,255,.18)`); kicker "DO THIS WEEK" in mint; three glass rows (bold action + muted estimate: Rebook @maria.eats before Saturday ≈ +$8,200 · Move the paid-ad budget to email ≈ +$2,400 · Tuesday 2-for-1 to your list ≈ +$2,300).
5. **AI agents** (`#agents`, bg `#F4F4F2`) — kicker "AI AGENTS · FREE WEBSITE OPTIMIZATION", h2 "Three agents watch your website, search results and bookings.", three white cards each with a before→after figure in `clamp(40px,4vw,56px)/800` where the "after" is mint-ink: Search agent **#14 → #3** ("live music dinner near me"…), Website agent **6.8s → 1.2s**, Reservations agent **11% → 4%** (no-shows). Footnote "Illustrative results. Nothing changes on your site without your approval."
6. **Pricing** (`#pricing`) — one lavender pod (radius 32px): kicker PRICING, "$39.99" at `clamp(64px,8vw,112px)/800` with "a month" beside it, paragraph "One plan, everything included. No tiers, no add-ons, cancel whenever you like.", buttons "Create your account" (primary) / "Explore the demo" (secondary); right column six white rows with a check icon (Reservations & ticketing, set up for you · Unlimited tracked links & promo codes · Click-to-door attribution · The weekly brief, every Monday · Website modernization, SEO & AI discovery · Expert guidance, included).
7. **Close** (bg `#111`) — h2 "Likes don't pay the rent. **Guests do.**" (second sentence mint; `clamp(44px,6vw,92px)/800`), paragraph, white pill "Start for $39.99 a month". Footer row: reverse logo + "Profit Monitr", "© 2026", right-aligned "Log in · Create account".

**Routing:** every Start / Create account → `/signup`; Log in → `/login` (same page in login mode); "Explore the demo" → `/app`.

---

## Screen 2 — Sign-up & log-in (`Monitr Signup.dc.html`)

Layout: body `#111`, 16px padding, two columns `300px minmax(0,1fr)` (single column under 880px; the sidebar then collapses and the logo moves into the main header). Left sidebar is on the black frame (white text); main is the white canvas (radius 32px).

**Sidebar (sign-up mode):** reverse logo; h1 "Start filling the room." (`clamp(32px,3vw,44px)/800`); sub "Three quick steps. We set up your reservations and ticketing as soon as you're in."; step list — Your account / Your venue / Billing — each a 14px-radius row with a 28px numbered circle; current step row bg `rgba(255,255,255,.1)`, circle white; completed circle mint with ✓; upcoming circle `rgba(255,255,255,.12)`. Bottom: plan card (`rgba(255,255,255,.08)`, radius 20px) "Your plan · $39.99 /mo" and five bullet lines with 6px mint dots.
**Sidebar (log-in mode):** h1 "Your Monday brief is waiting." + sub "Log in to see what happened, why, and what to do next."

**Main header:** right-aligned "Already have an account? [Log in]" / "New to Profit Monitr? [Create account]" toggle (secondary pill).

**Form column:** max-width 560px. Progress bar 6px, radius 999px, track `#F4F4F2`, fill `#111`, width 33/66/100 %, `transition: width 600ms cubic-bezier(.2,.7,.2,1)`. Inputs: 50px tall, radius 14px, 1.5px `#ECECEA` border (error `#C0392B`), 15px/500, 16px side padding; labels 14px/600 above; error line 13px/500 `#C0392B`.

- **Step 1 — Create your account:** Full name, Work email, Password (+ 4-segment strength meter: 5px pills, colours weak `#C0392B` → fair `#E1AD66` → good `#8FD9B0` → strong `#2ECC71`; score = length ≥ 8, uppercase, digit, symbol). Validation: name ≥ 2 chars, valid email, password ≥ 8. Button "Continue →".
- **Step 2 — Tell us about your venue:** Venue name; Venue type chips (single-select: Restaurant, Bar & lounge, Nightclub, Event venue, Other); City + Current website (optional); "What do you sell?" chips (multi: Table reservations, Event tickets; at least one); "Where do you promote today?" chips (multi: Instagram, TikTok, Email, Google, Paid social, Influencers, Promoters). Chip: pill, 11px 16px, 14px/600; selected bg `#111` text `#fff`, unselected white with `#ECECEA` border. Buttons Back / Continue →.
- **Step 3 — Billing:** note "Prototype — no payment is processed."; Name on card, Card number (auto-grouped 4-4-4-4, 16 digits), Expiry (auto `MM/YY`), CVC (3–4), ZIP; "Due today $39.99" row on `#F4F4F2`; consent checkbox (accent `#111`). Submit "Start my subscription →" → 1.4s loading state with a 14px spinner ("Creating your account…").
- **Done:** 64px mint circle with check; "You're in, {firstName}." + "We're setting up {venue} right now."; four rows that fade/slide in 550ms apart (Account created · Reservations & ticketing workspace ready · First tracked link: monitr.link/{venue-slug}/ig · First weekly brief scheduled for {next Monday}); then "Go to your dashboard →" fades in → `/app`.
- **Log in:** Email, Password, error "We couldn't find that email and password.", "Log in →". Prototype accepts demo@copperroom.com / monitr123 and any account created in this browser (stored in `localStorage.tpm_accounts`). Replace with real auth.

---

## Screen 3 — The app (`Monitr App.dc.html`)

Layout: body `#111`, 16px padding, grid `232px minmax(0,1fr)` (under 980px: single column, sidebar replaced by a horizontal pill tab row under the header). Sidebar is on the black frame; main is the white canvas (radius 32px, padding `clamp(20px,3vw,36px)` / 48px bottom).

**Sidebar:** reverse logo + wordmark; venue + user ("The Copper Room / Alex Rivera"); nav buttons (14px/600, radius 14px, padding 12px, Lucide-style 18px icons at 1.8 stroke): Overview · Revenue · Reservations & tickets · Channels & content · Live (green dot) · Next actions (mint count badge) · Website & SEO. Active: bg `#fff` text `#111`; inactive: transparent, `rgba(255,255,255,.7)`. Bottom card "Weekly report — Next one lands {next Monday}." with white pill "Read last week's".

**Top bar (all sections):** live line with green dot "Live · 61 guests in tonight · $4,860 so far" (ticks up); right: segmented range "This week / Last week / 30 days" + primary pill "Ask the agent" (shows a toast). Bottom border 1.5px `#ECECEA`.

**Shared patterns**
- Section kicker (13px/600 `#666` uppercase) + screen h1.
- KPI card: radius 22px, `1.5px #ECECEA` border or a mint fill for the hero metric; label 14px `#666`, number 40px/800 tnum, delta 13px/600 (mint-ink when positive).
- Pill-bar chart: bars `flex:1`, radius 999px, highlighted bar `#111`, others `rgba(255,255,255,.75)` on a tinted pod; day labels 12px under.
- Horizontal bar rows: `grid-template-columns: minmax(110px,160px) minmax(0,1fr) 130px`, track white or `#F4F4F2` 14px tall radius 999px, fill `#111` (weak channel `#BBB` and greyed label).
- Verdict pills (12px/700): Scale it → mint; Keep going → `#F4F4F2`; Fix or cut → `#111`/white; Working / Steady / Not working in the Channels ranking use the same three.
- Toast: fixed bottom-centre, `#111`, radius 999px, 12px 18px, 14px/600, 2.6s.

**Sections**
1. **Overview** — hero row: kicker "WHAT HAPPENED · SEP 21–27", h1 "Your marketing made [$48,920] in sales." (figure on a mint pill, radius 14px), summary paragraph, buttons "See what to do next" → Next actions, "Where it came from" → Revenue; right: mint pod "Revenue by day" with 7 pill bars (3100/2400/4200/6800/11900/15200/5320; Sat highlighted) and note "Sat · $15,200 · @maria.eats reel". Then "At a glance": four clickable KPI cards (Reservations 247 +12% · Tickets sold 123 +9% · Guests at the door 314 "85% of bookings showed up" · Return on marketing 4.4× "on $11,100 spent"; hover border `#111`). Then two pods: lavender "Why it happened" (three numbered points) and dark "Your next best action" (title, description, Approve + estimate; shows the first unapproved action; "All N →" link).
2. **Revenue** — h1 "Influencers brought the most money. Email brought the most per dollar."; KPI row (Revenue from marketing $48,920 mint · Share of all sales 61% · Revenue per guest $156 · Marketing spend $11,100); grey pod "Revenue by channel" bars (Instagram influencers $18,420 · 6.1× / Email $11,180 · 9.3× / Google search $9,640 · free / TikTok $6,120 · 3.4× / Paid social $3,560 · 1.2× greyed); table "Content that made money" (name + channel, Guests, Revenue, Per guest, verdict pill).
3. **Reservations & tickets** — h1 "247 tables and 123 tickets. 85% of them walked through the door."; KPIs (Reservations, Tickets, Guests at the door mint, No-shows 4% "reminders on · was 11%"); lavender "Bookings by day" pill chart (21/17/29/44/78/96/29, note "Tue is your quiet night"); "Where bookings came from" bar rows (booked · showed); "Coming up" cards with progress bars (Fri Jazz Night 86% sold · Sat Sunset Sessions 64% booked · Oct 31 Halloween 18 early-bird tickets).
4. **Channels & content** — h1 "Clicks are noise. Guests at the door are the signal."; segmented "Rank by: Clicks / Guests at the door / Revenue / Conversion" with a one-line insight that changes per sort; ranked rows (rank 28px/800; name + "channel · code"; three mini bars Clicks grey / At door black 10px / Revenue mint-dark; verdict pill + "x.x% click → door"). Data in `Component.CH` inside the file (6 sources incl. a promoter).
5. **Live** — h1 "{door} guests in tonight. {remaining} more on the way."; KPIs (Revenue tonight mint, Bookings today, Checked in, Top source tonight @maria.eats); activity feed (time · dot colour by type: check-in green, agent lavender, else black · bold event + source · amount) that prepends a new event every 3.8s while the tab is visible; lavender "Tonight's arrivals" hourly pill chart (5p–11p); dark "Agent note" card with "Send the email" → becomes "Sent · tracking" + toast.
6. **Next actions** — h1 "Three moves, ranked by what they're worth."; three action rows (52px number circle, 20px/800 title, 14px description, mint-ink estimate, Approve pill). Approved → row turns mint, number becomes ✓, button "Approved" text-only, estimate "Approved · scheduled · result in Monday's report". Below: grey "Last week's actions · results" (two done with results, one skipped) and dark "Want a second opinion?" with "Book a 30-minute session" → "Requested · we'll email you".
7. **Website & SEO** — h1 "Three AI agents watch your site, search and bookings around the clock."; KPIs (Local search rank #3 mint "from #14…", SEO health 82 "was 41 · 3 issues open", Page speed 1.2s "was 6.8s", AI assistants recommending you 3 of 5 "website visits from AI: 212"); three agent cards (SEO agent Active · Website agent "3 to review"/"Working" · Reservations agent Active) with what each did; "Recommendations waiting for you" rows (Add a 'Book a table' button to every event page · Publish a Halloween event page · Answer 6 unanswered Google reviews) each with Approve → mint row "Approved · agent working".

**State (app):** `tab`, `range` (week | last | month — scales every figure by 1 / 0.85 / 4.1 and swaps labels, day arrays and summary), `sort`, `approved{}`, `recsDone{}`, `feed[]`, `live{rev,bookings,tickets,door,expected}`, `toast`, `tonight`, `expert`. All sample data lives in static tables at the top of the logic class in `Monitr App.dc.html` — use them as fixtures and replace with API data: `GET /metrics?range=`, `GET /channels`, `GET /content`, `GET /reservations`, `GET /live` (SSE/websocket for the feed), `GET/POST /actions`, `GET/POST /website/recommendations`.

**Responsive:** everything is `repeat(auto-fit, minmax(min(100%, Npx), 1fr))`; sidebar → pill tabs under 980px (app) / 880px (sign-up); landing header links hide under 960px.

---

## Interactions & motion summary
- Bars/width changes: `transition: width/height 600ms cubic-bezier(.2,.7,.2,1)`.
- Approvals: background 300ms; done-screen rows: opacity + translateY(8px) 500ms, staggered 550ms.
- Spinner: 14px ring, 800ms linear.
- Smooth anchor scrolling on the landing; respect `prefers-reduced-motion`.
- Hero film: 21s loop, five scenes (Post 6s → Likes 1.75s → Ledger 3.5s → Reckoning 5s → Close 5s); scene list is in `window.OM_SCENES` at the top of the landing file; composition in `likes-piece.jsx`.

## Assets
- `assets/logo/*.svg` — mark (light / mono / gold / reverse), horizontal lockups (light / reverse), favicon.
- Figtree from Google Fonts.
- Icons: Lucide (18px, stroke 1.8) — grid, dollar, calendar-check, bar-chart, activity, check-square, globe, check.
- Animation sources: `likes-piece.jsx`, `likes-parts.jsx`, `animations-v3.jsx`, `tweaks-panel.jsx` (engine dependency only).

## Files in this bundle
- `Profit Monitr Landing v2.dc.html` — landing page
- `Monitr Signup.dc.html` — sign-up (3 steps + done) and log-in
- `Monitr App.dc.html` — the seven-section app
- `support.js` — runtime needed to open the `.dc.html` files locally
- `animations-v3.jsx`, `tweaks-panel.jsx`, `likes-parts.jsx`, `likes-piece.jsx` — hero animation
- `assets/logo/` — brand marks

Open the HTML files directly in a browser to click through every state described above.
