/**
 * Landing page copy (docs/design-handoff/Profit Monitr Landing v2.dc.html).
 * Edit text here; the components only lay it out.
 */

export const NAV = [
  { label: "How it works", href: "#how" },
  { label: "Weekly brief", href: "#brief" },
  { label: "AI agents", href: "#agents" },
  { label: "Pricing", href: "#pricing" },
];

export const HERO = {
  tag: "For restaurants, bars & venues",
  body: "Monitr ties every reservation, ticket and sale back to the post, link or campaign that earned it — then tells you, every Monday, exactly what to do next.",
  primary: "Start for $39.99 a month",
  secondary: "See how it works",
  footnotes: ["Everything included", "Reservations set up for you", "Cancel anytime"],
  filmCaption: "Likes don't pay the rent · 21 s",
};

export const PROMISES = [
  { n: "01", tone: "mint", title: "Every booking traced to its source", body: "A unique link and promo code for each influencer, promoter and campaign — credited all the way to the door." },
  { n: "02", tone: "lavender", title: "One brief, every Monday", body: "What happened, why, what made money and the three moves worth making this week — from your own data." },
  { n: "03", tone: "butter", title: "Your website, optimized for free", body: "AI agents keep your site fast and found — by Google and by AI assistants — and ask before they change anything." },
] as const;

export const HOW = {
  kicker: "HOW IT WORKS",
  title: "From the first click to the front door.",
  intro: "No spreadsheets, no guessing. Three steps and you know which marketing fills the room.",
  steps: [
    { title: "We set up reservations and ticketing", body: "Native to your account, so every table and ticket is yours — your availability, your prices, your guest data." },
    { title: "You share links and codes", body: "One for every influencer, promoter and campaign. Clicks, bookings, ticket sales and check-ins are credited to whoever earned them." },
    { title: "Monday, you read the brief and act", body: "One page in plain language. Three recommendations ranked by what they're worth, with a strategist a click away." },
  ],
};

export const BRIEF = {
  kicker: "THE WEEKLY BRIEF",
  title: "A brief, not a dashboard.",
  body: "You shouldn't need to decode charts to run a Saturday. The brief reads top to bottom — what happened, why, what generated revenue, what to do next. Tick an action off and see its result the following Monday.",
  rows: [
    { label: "Personal to your venue", note: "your sales, bookings, guests" },
    { label: "Actionable", note: "three moves, ranked by return" },
    { label: "Expert guidance", note: "included, a click away" },
  ],
  card: {
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
  },
};

export const AGENTS = {
  kicker: "AI AGENTS · FREE WEBSITE OPTIMIZATION",
  title: "Three agents watch your website, search results and bookings.",
  cards: [
    { name: "Search agent", before: "#14", after: "→ #3", body: "“live music dinner near me”, after fixed pages, event schema and answered reviews." },
    { name: "Website agent", before: "6.8s", after: "→ 1.2s", body: "A modern, mobile-ready site with the booking button one tap away — and recommended by AI assistants." },
    { name: "Reservations agent", before: "11%", after: "→ 4%", body: "No-shows, after reminders and waitlist fills. Quiet nights flagged before they happen." },
  ],
  footnote: "Illustrative results. Nothing changes on your site without your approval.",
};

export const PRICING = {
  kicker: "PRICING",
  price: "$39.99",
  per: "a month",
  body: "One plan, everything included. No tiers, no add-ons, cancel whenever you like.",
  primary: "Create your account",
  secondary: "Explore the demo",
  features: [
    "Reservations & ticketing, set up for you",
    "Unlimited tracked links & promo codes",
    "Click-to-door attribution",
    "The weekly brief, every Monday",
    "Website modernization, SEO & AI discovery",
    "Expert guidance, included",
  ],
};

export const CLOSE = {
  title: "Likes don't pay the rent.",
  accent: "Guests do.",
  body: "See which posts, people and campaigns actually fill your room — and do more of what works, starting Monday.",
  cta: "Start for $39.99 a month",
};
