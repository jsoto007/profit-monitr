import { AGENTS, CHANNELS, CONTENT, FIXED, KPI, LIVE, POOL, RANGE, SORT_NOTES, UPCOMING, WEAK_ROI, WEBSITE_KPIS, WHY } from "@/data/sample";
import type { RangeKey } from "@/lib/time";
import type { ChannelRow, ChannelVerdict, LiveData, LiveEvent, RangeData, WebsiteData } from "./types";

export function channelVerdict(clicks: number, door: number): ChannelVerdict {
  if (!clicks) return "New";
  const rate = door / clicks;
  return rate >= 0.06 ? "Working" : rate >= 0.035 ? "Steady" : "Not working";
}

/** The sample venue for one range: a week's figures scaled by the range multiplier. */
export function sampleRange(key: RangeKey): RangeData {
  const R = RANGE[key];
  const m = R.m;
  const scale = (n: number) => Math.round(n * m);

  const channels: ChannelRow[] = CHANNELS.map((c) => ({
    id: c.id,
    name: c.name,
    detail: c.detail,
    code: c.code,
    clicks: scale(c.clicks),
    booked: scale(c.booked),
    door: scale(c.door),
    revCents: scale(c.revCents),
    roi: c.roi,
    weak: c.roi === WEAK_ROI,
    rate: c.door / c.clicks,
    verdict: channelVerdict(c.clicks, c.door),
    // The sample venue books on its Monitr page: every figure is measured.
    fidelity: "exact",
    provider: "native",
    destination: "",
  }));

  return {
    metrics: {
      range: key,
      rangeLabel: R.label,
      revCents: scale(KPI.revCents),
      res: scale(KPI.res),
      tix: scale(KPI.tix),
      door: scale(KPI.door),
      spendCents: R.spendCents,
      roi: FIXED.roi,
      deltas: { rev: R.d[0], res: R.d[1], tix: R.d[2], door: R.d[3] },
      showRate: FIXED.showRate,
      shareOfSales: FIXED.shareOfSales,
      revPerGuest: FIXED.revPerGuest,
      revPerGuestNote: FIXED.revPerGuestNote,
      noShowRate: FIXED.noShowRate,
      noShowNote: FIXED.noShowNote,
      chart: { title: R.chartTitle, note: R.note, bars: R.days.map((value, i) => ({ label: R.dayLabels[i], value })) },
      summary: R.summary,
      why: WHY,
      revenueHeadline: FIXED.revenueHeadline,
      // The sample venue books on its own page: everything is taken at the door.
      platformCents: 0,
      doorCents: scale(KPI.revCents),
      unattributedCents: 0,
    },
    channels,
    sortNotes: { ...SORT_NOTES },
    content: CONTENT.map((r) => ({
      id: r.id,
      name: r.name,
      channel: r.channel,
      door: scale(r.door),
      revCents: scale(r.revCents),
      perGuestCents: Math.round(r.revCents / r.door),
      verdict: r.verdict,
    })),
    reservations: {
      bars: R.bookings.map((value, i) => ({ label: R.dayLabels[i], value })),
      quietNote: FIXED.quietNote,
      sources: [...CHANNELS]
        .sort((a, b) => b.booked - a.booked)
        .slice(0, 5)
        .map((c) => ({ id: c.id, name: c.name, booked: scale(c.booked), door: scale(c.door) })),
      upcoming: UPCOMING,
    },
  };
}

/** The n-th simulated event of the sample venue's evening. */
export function sampleEvent(index: number, at: Date): LiveEvent {
  const e = POOL[((index % POOL.length) + POOL.length) % POOL.length];
  return { ...e, id: `sim-${index}-${at.getTime()}`, at: at.toISOString() };
}

/** Where the sample evening stands when the dashboard opens: six events, nine minutes apart. */
export function sampleLive(now: Date, note: LiveData["note"]): LiveData {
  return {
    revCents: LIVE.revCents,
    bookings: LIVE.bookings,
    tickets: LIVE.tickets,
    door: LIVE.door,
    expected: LIVE.expected,
    traced: LIVE.traced,
    top: { ...LIVE.top },
    feed: POOL.slice(0, 6).map((_, i) => sampleEvent(i, new Date(now.getTime() - i * 9 * 60_000))),
    hours: LIVE.hours.map((value, i) => ({ label: LIVE.hourLabels[i], value })),
    note,
  };
}

export function sampleWebsite(site: string, recs: WebsiteData["recs"]): WebsiteData {
  return { site, kpis: WEBSITE_KPIS, agents: AGENTS.map((a) => ({ ...a })), recs };
}
