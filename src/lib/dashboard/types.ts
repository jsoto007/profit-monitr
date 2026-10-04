import type { Fidelity, Provider } from "@/lib/destinations";
import type { RangeKey } from "@/lib/time";

/**
 * The dashboard contract. The server builds it either from the sample venue
 * (src/data/sample.ts) or from a venue's own activity (./real.ts); the client
 * only ever sees these shapes. Money is integer cents; display strings are
 * formatted in the UI unless a field is documented as a label.
 */

export type Verdict = "Scale it" | "Keep going" | "Fix or cut";
/** "Getting clicks" is the only verdict a clicks-only source can earn: nothing after the click is measurable here. */
export type ChannelVerdict = "Working" | "Steady" | "Not working" | "New" | "Getting clicks";
export type SortKey = "clicks" | "door" | "rev" | "rate";
export const SORT_KEYS: SortKey[] = ["clicks", "door", "rev", "rate"];

export type Bar = { label: string; value: number };

/** `**bold**` marks the emphasised words; see <Rich>. */
export type RichText = string;

export type Metrics = {
  range: RangeKey;
  /** "SEP 21–27" */
  rangeLabel: string;
  revCents: number;
  res: number;
  tix: number;
  door: number;
  spendCents: number;
  /** "4.4×" or "—" */
  roi: string;
  deltas: { rev: string; res: string; tix: string; door: string };
  /** "85%" or "—" */
  showRate: string;
  shareOfSales: string;
  revPerGuest: string;
  revPerGuestNote: string;
  noShowRate: string;
  noShowNote: string;
  chart: { title: string; note: string; bars: Bar[] };
  summary: string;
  why: RichText[];
  revenueHeadline: string;
};

export type ChannelRow = {
  id: string;
  name: string;
  detail: string;
  code: string;
  clicks: number;
  booked: number;
  door: number;
  revCents: number;
  /** "6.1×", "free" or "—" */
  roi: string;
  /** greyed out in "Revenue by channel" */
  weak: boolean;
  /** door ÷ clicks, unscaled; drives the verdict and the Conversion sort. 0 for a clicks-only source */
  rate: number;
  verdict: ChannelVerdict;
  /** what this source's figures can prove: exact (Monitr page + door), platform (imported orders) or clicks */
  fidelity: Fidelity;
  /** where its link sends people */
  provider: Provider;
  /** the pasted destination, for editing; empty = the venue's booking page */
  destination: string;
};

export type ContentRow = {
  id: string;
  name: string;
  channel: string;
  door: number;
  revCents: number;
  perGuestCents: number;
  verdict: Verdict;
};

export type Upcoming = { id: string; when: string; headline: string; pct: number; note: string };

export type Reservations = {
  bars: Bar[];
  quietNote: string;
  sources: { id: string; name: string; booked: number; door: number }[];
  upcoming: Upcoming[];
};

export type RangeData = {
  metrics: Metrics;
  channels: ChannelRow[];
  sortNotes: Record<SortKey, string>;
  content: ContentRow[];
  reservations: Reservations;
};

export type ActionItem = {
  id: string;
  title: string;
  description: string;
  estimate: string;
  tip: string;
  approved: boolean;
};

export type PastAction = { id: string; title: string; result: string; done: boolean };

export type ActionsData = {
  /** "WEEK OF SEP 28" */
  weekLabel: string;
  current: ActionItem[];
  past: PastAction[];
  expertRequested: boolean;
};

export type WebsiteKpi = { label: string; value: string; note: string; highlight?: boolean };
export type WebsiteAgent = { name: string; status: string; tone: "mint" | "lavender"; body: string; foot: string };
export type Recommendation = { id: string; title: string; description: string; approved: boolean };

export type WebsiteData = {
  site: string;
  kpis: WebsiteKpi[];
  agents: WebsiteAgent[];
  recs: Recommendation[];
};

export type LiveKind = "book" | "tix" | "door" | "agent";

export type LiveEvent = {
  id: string;
  k: LiveKind;
  txt: string;
  src: string;
  amountCents: number;
  /** guests or tickets carried by the event */
  n: number;
  /** ISO instant */
  at: string;
  /** false when a booking is for another night and so does not add to tonight's "expected" */
  tonight?: boolean;
};

export type LiveData = {
  revCents: number;
  bookings: number;
  tickets: number;
  door: number;
  expected: number;
  traced: string;
  top: { name: string; note: string };
  feed: LiveEvent[];
  hours: Bar[];
  note: { id: string; body: string; sent: boolean } | null;
};

export type DashboardPayload = {
  venue: { name: string; slug: string; website: string; timezone: string; bookingProvider: Provider; bookingUrl: string };
  user: { name: string; isDemo: boolean };
  /** true → figures come from the sample venue, not this venue's activity */
  sample: boolean;
  /** "Monday, Oct 5" */
  nextBrief: string;
  /** ISO instant the payload was built; keeps server and client clocks in step */
  now: string;
  /** "monitr.link/the-copper-room/ig" */
  firstLink: string;
  ranges: Partial<Record<RangeKey, RangeData>>;
  actions: ActionsData;
  website: WebsiteData;
  live: LiveData;
};
