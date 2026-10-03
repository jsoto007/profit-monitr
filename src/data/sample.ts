/**
 * The sample venue — "The Copper Room" — exactly as specified in the design
 * handoff (docs/design-handoff/Monitr App.dc.html, static tables at the top
 * of the logic class). The demo account always shows it; a new venue shows it
 * until the owner switches to their own data.
 *
 * Money is integer cents. `m` scales a week's figures to the selected range.
 */

import type { RangeKey } from "@/lib/time";
import type { LiveKind, Verdict } from "@/lib/dashboard/types";

export const DEMO = {
  email: "demo@copperroom.com",
  password: "monitr123",
  name: "Alex Rivera",
  venue: "The Copper Room",
  type: "Bar & lounge",
  city: "Austin, TX",
  website: "thecopperroom.com",
  timezone: "America/Chicago",
} as const;

export const KPI = { revCents: 4_892_000, res: 247, tix: 123, door: 314 } as const;

export const CHANNELS = [
  { id: "s-ig", name: "Instagram influencers", detail: "Instagram · @maria.eats", code: "MARIA10", clicks: 2220, booked: 157, door: 142, revCents: 1_842_000, roi: "6.1×" },
  { id: "s-email", name: "Email", detail: "Newsletter · 1,200 subscribers", code: "SEPT-NL", clicks: 420, booked: 52, door: 49, revCents: 1_118_000, roi: "9.3×" },
  { id: "s-google", name: "Google search", detail: "Business profile", code: "GOOGLE", clicks: 760, booked: 58, door: 51, revCents: 964_000, roi: "free" },
  { id: "s-tiktok", name: "TikTok", detail: "TikTok · @jaynights", code: "JAY2X", clicks: 980, booked: 61, door: 39, revCents: 612_000, roi: "3.4×" },
  { id: "s-paid", name: "Paid social", detail: "Fall campaign", code: "FALL15", clicks: 3100, booked: 41, door: 33, revCents: 356_000, roi: "1.2×" },
  { id: "s-leo", name: "Promoter · Leo R.", detail: "Saturday Late", code: "LEO", clicks: 310, booked: 44, door: 39, revCents: 430_000, roi: "4.8×" },
] as const;

/** The one channel greyed out in "Revenue by channel". */
export const WEAK_ROI = "1.2×";

export const CONTENT: { id: string; name: string; channel: string; door: number; revCents: number; verdict: Verdict }[] = [
  { id: "c-reel", name: "Sunset Sessions reel", channel: "Instagram · @maria.eats", door: 88, revCents: 984_000, verdict: "Scale it" },
  { id: "c-jazz-email", name: "Jazz Night first-access email", channel: "Email", door: 49, revCents: 612_000, verdict: "Scale it" },
  { id: "c-google", name: "Google Business profile", channel: "Search", door: 51, revCents: 590_000, verdict: "Keep going" },
  { id: "c-jazz-tiktok", name: "Jazz Night TikTok", channel: "TikTok · @jaynights", door: 54, revCents: 430_000, verdict: "Keep going" },
  { id: "c-fall-ad", name: "Fall paid social ad", channel: "Paid · $3,000", door: 33, revCents: 210_000, verdict: "Fix or cut" },
];

export const RANGE: Record<RangeKey, {
  m: number;
  label: string;
  /** rev, res, tix, door */
  d: [string, string, string, string];
  spendCents: number;
  note: string;
  /** revenue per bar, cents */
  days: number[];
  dayLabels: string[];
  chartTitle: string;
  bookings: number[];
  summary: string;
}> = {
  week: {
    m: 1, label: "SEP 21–27", d: ["+18%", "+12%", "+9%", "+18%"], spendCents: 1_110_000,
    note: "Sat · $15,200 · @maria.eats reel",
    days: [310_000, 240_000, 420_000, 680_000, 1_190_000, 1_520_000, 532_000],
    dayLabels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    chartTitle: "Revenue by day",
    bookings: [21, 17, 29, 44, 78, 96, 29],
    summary: "That's 4.4× what you spent and 18% more than last week. One Saturday reel did most of the work — and one paid ad did almost none.",
  },
  last: {
    m: 0.85, label: "SEP 14–20", d: ["+6%", "+4%", "−3%", "+6%"], spendCents: 1_040_000,
    note: "Sat · $12,900",
    days: [280_000, 210_000, 360_000, 590_000, 1_010_000, 1_290_000, 420_000],
    dayLabels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    chartTitle: "Revenue by day",
    bookings: [21, 17, 29, 44, 78, 96, 29].map((x) => Math.round(x * 0.85)),
    summary: "A steady week. Google and your promoter Leo carried Saturday; the paid ad kept under-delivering.",
  },
  month: {
    m: 4.1, label: "LAST 30 DAYS", d: ["+19%", "+17%", "+12%", "+19%"], spendCents: 4_480_000,
    note: "Best week · Sep 21–27",
    days: [4_120_000, 4_490_000, 4_892_000, 5_010_000],
    dayLabels: ["Sep 7", "Sep 14", "Sep 21", "Sep 28"],
    chartTitle: "Revenue by week",
    bookings: [211, 229, 247, 254],
    summary: "Your best month since spring. Influencers and email grew every week; paid social stayed flat.",
  },
};

/** Figures the design holds constant across ranges. */
export const FIXED = {
  roi: "4.4×",
  showRate: "85%",
  shareOfSales: "61%",
  revPerGuest: "$156",
  revPerGuestNote: "$172 on weekends",
  noShowRate: "4%",
  noShowNote: "reminders on · was 11%",
  quietNote: "Tue is your quiet night",
  revenueHeadline: "Influencers brought the most money. Email brought the most per dollar.",
} as const;

export const WHY = [
  "Saturday's reel by **@maria.eats** reached people already looking for live music — 41% of weekend tables came with her code.",
  "**Email** turned 11.7% of clicks into guests, 10× the paid ad, because it reaches people who've already been in.",
  "The **paid ad** reached too wide an audience: 3,100 clicks, 33 guests.",
];

export const SORT_NOTES = {
  clicks: "By clicks, the paid ad looks like your star.",
  door: "By guests at the door, the same ad falls to last.",
  rev: "Influencers earn the most; email earns the most per dollar.",
  rate: "Email turns 11.7% of clicks into guests — 10× the ad.",
} as const;

export const UPCOMING = [
  { id: "u-jazz", when: "Fri · Jazz Night", headline: "86% sold", pct: 86, note: "14 tickets left · mostly via @jaynights" },
  { id: "u-sunset", when: "Sat · Sunset Sessions", headline: "64% booked", pct: 64, note: "9pm slot has 11 tables open" },
  { id: "u-halloween", when: "Oct 31 · Halloween", headline: "18 early-bird tickets", pct: 12, note: "Email list hasn't been told yet" },
];

/** Monday of the sample "this week" for Next actions ("WEEK OF SEP 28"). */
export const ACTIONS_WEEK = "2026-09-28";
export const PAST_WEEK = "2026-09-21";

export const ACTIONS = [
  { title: "Rebook @maria.eats before Saturday", description: "Her reel converted 7.1% of clicks into guests. A second post before the weekend should repeat it.", estimate: "Estimated +$8,200 this weekend", tip: "rebooking @maria.eats" },
  { title: "Pause the paid ad and put $1,500 into a Jazz Night email", description: "Email returns 9.3× per dollar; the ad returns 1.2×. Same money, eight times the result.", estimate: "Estimated +$2,400", tip: "moving the paid-ad budget into a Jazz Night email" },
  { title: "Send a Tuesday 2-for-1 to your email list", description: "Tuesday seats 17 guests and 40% of tables sit empty after 8pm.", estimate: "17 → ≈40 covers · +$2,300", tip: "sending a Tuesday 2-for-1 to your email list" },
];

export const PAST_ACTIONS = [
  { title: "Gave @maria.eats her own code", status: "done", result: "→ 88 guests credited, $9,840 revenue" },
  { title: "Added booking link to Google profile", status: "done", result: "→ 51 guests, up from 32" },
  { title: "Fill the Friday 9pm slot", status: "skipped", result: "Skipped — 40% of 9pm tables still empty" },
] as const;

export const RECS = [
  { title: 'Add a "Book a table" button to every event page', description: "Visitors who land on an event page book 2.3× more often when the button is one tap away." },
  { title: "Publish a Halloween event page", description: 'Searches for "halloween party austin" start climbing in two weeks. Being early is worth ~#5 by Oct 20.' },
  { title: "Answer 6 unanswered Google reviews", description: "Response rate feeds your local ranking and AI recommendations." },
];

export const WEBSITE_KPIS = [
  { label: "Local search rank", value: "#3", note: "from #14 · “live music dinner near me”", highlight: true },
  { label: "SEO health", value: "82", note: "was 41 · 3 issues open" },
  { label: "Page speed", value: "1.2s", note: "was 6.8s · mobile-ready" },
  { label: "AI assistants recommending you", value: "3 of 5", note: "website visits from AI: 212" },
];

export const AGENTS = [
  { name: "SEO agent", status: "Active", tone: "mint", body: "Fixed 3 broken pages, added event schema, resubmitted the sitemap. Watching 12 local keywords.", foot: "Last change: 2h ago" },
  { name: "Website agent", status: "", tone: "lavender", body: "Compressed images, moved booking button above the fold, checks every page nightly on mobile.", foot: "Speed 6.8s → 1.2s" },
  { name: "Reservations agent", status: "Active", tone: "mint", body: "Sends reminders, fills cancellations from the waitlist, flags quiet nights early.", foot: "No-shows 11% → 4% · 12 waitlist seats filled" },
] as const;

export const AGENT_NOTE =
  "Saturday's 9pm slot still has 11 tables open. Your email list books 11.7% of the time — a \"tonight only\" note to 1,200 subscribers should fill them.";

export const LIVE = {
  revCents: 486_000,
  bookings: 42,
  tickets: 18,
  door: 61,
  expected: 112,
  traced: "64%",
  top: { name: "@maria.eats", note: "18 guests · code MARIA10" },
  hours: [6, 14, 22, 31, 38, 24, 9],
  hourLabels: ["5p", "6p", "7p", "8p", "9p", "10p", "11p"],
} as const;

/** The simulated activity the sample venue cycles through, one event every 3.8 s. */
export const POOL: { k: LiveKind; txt: string; src: string; amountCents: number; n: number }[] = [
  { k: "book", txt: "Table for 4 booked", src: "@maria.eats · code MARIA10", amountCents: 31_200, n: 4 },
  { k: "tix", txt: "2 tickets · Jazz Night", src: "@jaynights · code JAY2X", amountCents: 7_000, n: 2 },
  { k: "door", txt: "Party of 6 checked in", src: "Newsletter · SEPT-NL", amountCents: 0, n: 6 },
  { k: "book", txt: "Table for 2 booked", src: "Google Business profile", amountCents: 14_000, n: 2 },
  { k: "door", txt: "Party of 3 checked in", src: "Promoter · LEO", amountCents: 0, n: 3 },
  { k: "tix", txt: "4 tickets · Saturday Late", src: "@maria.eats · MARIA10", amountCents: 14_000, n: 4 },
  { k: "agent", txt: "SEO agent · sitemap resubmitted", src: "Website agent", amountCents: 0, n: 0 },
  { k: "book", txt: "Table for 5 booked", src: "Instagram · bio link", amountCents: 39_000, n: 5 },
];

export const LIVE_TICK_MS = 3800;
