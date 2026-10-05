/**
 * Landing page copy. The layout follows the design handoff
 * (docs/design-handoff/Profit Monitr Landing v2.dc.html); the words follow the
 * overlay positioning in claude-reports/Product-Plan/ — Monitr tracks alongside
 * the booking page a venue already uses, it does not replace it.
 * Edit text here; the components only lay it out.
 */

export const NAV = [
  { label: "How it works", href: "#how" },
  { label: "Weekly brief", href: "#brief" },
  { label: "Sample brief", href: "/brief/sample" },
  { label: "Pricing", href: "#pricing" },
];

export const HERO = {
  tag: "For bars, clubs, event venues & restaurants",
  body: "Monitr sits on top of the booking page you already use — Posh, Eventbrite, Resy, OpenTable or your own site — and ties every ticket, reservation and guest at the door back to the post, promoter or campaign that earned it. Then, every Monday, it tells you exactly what to do next.",
  primary: "See a sample brief",
  call: "Book a 15-minute call",
  pilot: "Start a free pilot",
  footnotes: ["Works with what you already use", "Free during the pilot", "Cancel anytime"],
  filmCaption: "Likes don't pay the bills · 21 s",
};

export const PROMISES = [
  { n: "01", tone: "mint", title: "Every guest traced to its source", body: "A unique link and promo code for each influencer, promoter and campaign — credited from the click to the door, and labelled by what it can prove." },
  { n: "02", tone: "lavender", title: "One brief, every Monday", body: "What happened, why, what made money and the three moves worth making this week — from your own data." },
  { n: "03", tone: "butter", title: "Nothing to migrate", body: "Your links point at Posh, Eventbrite, Resy, OpenTable or your own site. Upload your ticket orders and the brief sees the whole funnel." },
] as const;

export const HOW = {
  kicker: "HOW IT WORKS",
  title: "From the first click to the front door.",
  intro: "No new booking system, no spreadsheets. Three steps and you know which marketing fills the room.",
  steps: [
    { title: "Point your links at what you already use", body: "Posh, Eventbrite, Resy, OpenTable or your own site. Nothing moves — your availability, prices and guest data stay where they are." },
    { title: "Share links and codes", body: "One for every influencer, promoter and campaign. Clicks, promo codes and ticket orders are credited to whoever earned them." },
    { title: "Monday, read the brief and act", body: "One page in plain language. Three recommendations ranked by what they're worth, and honest about what the numbers can prove." },
  ],
};

export const BRIEF = {
  kicker: "THE WEEKLY BRIEF",
  title: "A brief, not a dashboard.",
  body: "You shouldn't need to decode charts to run a Saturday. The brief reads top to bottom — what happened, why, what generated revenue, what to do next. Tick an action off and see its result the following Monday.",
  rows: [
    { label: "Personal to your venue", note: "your sales, bookings, guests" },
    { label: "Actionable", note: "three moves, ranked by return" },
    { label: "Honest", note: "clicks, orders and door check-ins, labelled" },
  ],
  card: {
    label: "Fictional sample venue · illustrative numbers",
    meta: "The Copper Room · Sep 21–27",
    delta: "+18%",
    headline: "Your marketing made $48,920 in sales. One Saturday reel did most of the work.",
    /** Mon → Sun, percent of the tallest bar; the highlighted bar is Saturday. */
    bars: [20, 16, 28, 45, 78, 100, 35],
    highlight: 5,
    kicker: "DO THIS WEEK",
    actions: [
      { bold: "Rebook @maria.eats", rest: " before Saturday", est: "≈ +$8,200" },
      { bold: "Move the paid-ad budget", rest: " to email", est: "≈ +$2,400" },
      { bold: "Tuesday 2-for-1", rest: " to your list", est: "≈ +$2,300" },
    ],
    more: "Read the full sample brief",
  },
};

export const PRICING = {
  kicker: "PRICING",
  price: "$39.99",
  per: "a month",
  body: "One plan, everything included. Free during your pilot; $39.99 a month after, only if you choose to continue. Your Posh, Eventbrite or Resy setup doesn't change.",
  primary: "Start a free pilot",
  secondary: "Explore the demo",
  features: [
    "Works on top of Posh, Eventbrite, Resy, OpenTable or your own booking page",
    "Unlimited tracked links & promo codes",
    "Click-to-door attribution, labelled by what it can prove",
    "Ticket-order imports from Posh and Eventbrite (CSV)",
    "The weekly brief, every Monday",
    "One-click export of your bookings and guests",
  ],
};

export const CLOSE = {
  title: "Likes don't pay the bills.",
  accent: "Guests do.",
  body: "See which posts, people and campaigns actually fill your room — and do more of what works, starting Monday.",
  cta: "Start a free pilot",
  secondary: "See a sample brief",
};
