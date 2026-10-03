import { describe, expect, it } from "vitest";
import { applyEvent, type LiveState } from "@/components/app/useLive";
import { FILM, warp } from "@/components/landing/film/timeline";
import { sampleEvent, sampleLive, sampleRange } from "@/lib/dashboard/sample";
import { money } from "@/lib/util";

/** The sample venue must reproduce the design handoff's figures exactly, in every range. */
describe("sample venue — handoff figures", () => {
  it("this week", () => {
    const d = sampleRange("week");
    const m = d.metrics;
    expect([money(m.revCents), m.res, m.tix, m.door, money(m.spendCents), m.roi]).toEqual(["$48,920", 247, 123, 314, "$11,100", "4.4×"]);
    expect(m.rangeLabel).toBe("SEP 21–27");
    expect(m.deltas).toEqual({ rev: "+18%", res: "+12%", tix: "+9%", door: "+18%" });
    expect(m.chart.bars.map((b) => b.value / 100)).toEqual([3100, 2400, 4200, 6800, 11900, 15200, 5320]);
    expect(d.reservations.bars.map((b) => b.value)).toEqual([21, 17, 29, 44, 78, 96, 29]);
  });
  it("revenue by channel and return on spend", () => {
    const rows = [...sampleRange("week").channels].sort((a, b) => b.revCents - a.revCents).map((c) => `${c.name} ${money(c.revCents)} · ${c.roi}${c.weak ? " (weak)" : ""}`);
    expect(rows).toEqual([
      "Instagram influencers $18,420 · 6.1×", "Email $11,180 · 9.3×", "Google search $9,640 · free",
      "TikTok $6,120 · 3.4×", "Promoter · Leo R. $4,300 · 4.8×", "Paid social $3,560 · 1.2× (weak)",
    ]);
  });
  it("channel verdicts follow click-to-door conversion", () => {
    const v = Object.fromEntries(sampleRange("week").channels.map((c) => [c.code, `${c.verdict} ${(c.rate * 100).toFixed(1)}%`]));
    expect(v).toEqual({ MARIA10: "Working 6.4%", "SEPT-NL": "Working 11.7%", GOOGLE: "Working 6.7%", JAY2X: "Steady 4.0%", FALL15: "Not working 1.1%", LEO: "Working 12.6%" });
  });
  it("content table: guests, revenue and revenue per guest", () => {
    expect(sampleRange("week").content.map((c) => [c.name, c.door, money(c.revCents), money(c.perGuestCents), c.verdict])).toEqual([
      ["Sunset Sessions reel", 88, "$9,840", "$112", "Scale it"],
      ["Jazz Night first-access email", 49, "$6,120", "$125", "Scale it"],
      ["Google Business profile", 51, "$5,900", "$116", "Keep going"],
      ["Jazz Night TikTok", 54, "$4,300", "$80", "Keep going"],
      ["Fall paid social ad", 33, "$2,100", "$64", "Fix or cut"],
    ]);
  });
  it("where bookings came from: top five by bookings", () => {
    expect(sampleRange("week").reservations.sources.map((s) => `${s.name} ${s.booked}·${s.door}`)).toEqual([
      "Instagram influencers 157·142", "TikTok 61·39", "Google search 58·51", "Email 52·49", "Promoter · Leo R. 44·39",
    ]);
  });
  it("last week scales by 0.85 and swaps labels, deltas and days", () => {
    const d = sampleRange("last");
    const m = d.metrics;
    expect([money(m.revCents), m.res, m.tix, m.door, money(m.spendCents), m.rangeLabel]).toEqual(["$41,582", 210, 105, 267, "$10,400", "SEP 14–20"]);
    expect(m.deltas.tix).toBe("−3%");
    expect(d.reservations.bars.map((b) => b.value)).toEqual([18, 14, 25, 37, 66, 82, 25]);
    expect(money(d.channels[0].revCents)).toBe("$15,657");
    // Per-guest revenue and conversion do not scale with the range.
    expect(money(d.content[0].perGuestCents)).toBe("$112");
  });
  it("30 days scales by 4.1 and charts four weeks", () => {
    const m = sampleRange("month").metrics;
    expect([money(m.revCents), m.res, m.tix, m.door, m.rangeLabel, m.chart.title]).toEqual(["$200,572", 1013, 504, 1287, "LAST 30 DAYS", "Revenue by week"]);
    expect(m.chart.bars.map((b) => b.label)).toEqual(["Sep 7", "Sep 14", "Sep 21", "Sep 28"]);
    expect(sampleRange("month").reservations.bars.map((b) => b.value)).toEqual([211, 229, 247, 254]);
  });
});

describe("live", () => {
  const now = new Date("2026-10-03T23:00:00Z");
  const base = (): LiveState => {
    const l = sampleLive(now, null);
    return { revCents: l.revCents, bookings: l.bookings, tickets: l.tickets, door: l.door, expected: l.expected, feed: l.feed, now: now.toISOString() };
  };
  it("opens on the handoff's evening: 61 in, $4,860, six events nine minutes apart", () => {
    const l = sampleLive(now, null);
    expect([l.door, money(l.revCents), l.bookings, l.tickets, l.expected, l.feed.length]).toEqual([61, "$4,860", 42, 18, 112, 6]);
    expect(l.feed[1].at).toBe("2026-10-03T22:51:00.000Z");
  });
  it("applies each kind of event the way the prototype's ticker does", () => {
    let s = base();
    s = applyEvent(s, sampleEvent(1, now)); // 2 tickets · $70
    expect([s.tickets, s.revCents, s.bookings]).toEqual([20, 493_000, 42]);
    s = applyEvent(s, sampleEvent(2, now)); // party of 6 checks in
    expect([s.door, s.revCents]).toEqual([67, 493_000]);
    s = applyEvent(s, sampleEvent(3, now)); // table for 2 · $140
    expect([s.bookings, s.expected, s.revCents]).toEqual([43, 114, 507_000]);
    s = applyEvent(s, sampleEvent(6, now)); // agent event moves no counter
    expect([s.bookings, s.tickets, s.door, s.revCents]).toEqual([43, 20, 67, 507_000]);
    expect(s.feed).toHaveLength(8);
  });
  it("ignores a replayed event and bookings for another night", () => {
    const e = sampleEvent(3, now);
    const once = applyEvent(base(), e);
    expect(applyEvent(once, e)).toBe(once);
    const later = applyEvent(base(), { ...e, id: "x", tonight: false });
    expect([later.bookings, later.expected]).toEqual([43, 112]);
  });
});

describe("hero film timeline", () => {
  it("plays 21.25 s over 15 s of authored motion with the handoff's cues", () => {
    expect([FILM.total, FILM.authoredTotal]).toEqual([21.25, 15]);
    expect(FILM.cues).toEqual({ Post: 0, Likes: 3, Ledger: 6.5, Reckoning: 10, Close: 12.5 });
  });
  it("warps playback time into authored time scene by scene", () => {
    expect(warp(FILM, 0)).toBe(0);
    expect(warp(FILM, 3)).toBe(1.5); // Post plays at half speed
    expect(warp(FILM, 6)).toBe(3); // Likes starts
    expect(warp(FILM, 7.75)).toBe(6.5); // Ledger starts
    expect(warp(FILM, 21.25)).toBe(15);
    expect(warp(FILM, 99)).toBe(15);
  });
});
