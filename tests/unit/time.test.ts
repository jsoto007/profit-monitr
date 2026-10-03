import { describe, expect, it } from "vitest";
import { calendarDate, nextBriefLabel, rangeLabel, rangeWindow, startOfDay, weekStart, zonedParts, zonedTimeToUtc } from "@/lib/time";

const NY = "America/New_York";
const iso = (d: Date) => d.toISOString();

describe("zoned time", () => {
  it("converts local wall time to UTC on both sides of DST", () => {
    expect(iso(zonedTimeToUtc(2026, 7, 4, 19, 0, NY))).toBe("2026-07-04T23:00:00.000Z"); // EDT, UTC−4
    expect(iso(zonedTimeToUtc(2026, 12, 4, 19, 0, NY))).toBe("2026-12-05T00:00:00.000Z"); // EST, UTC−5
  });
  it("finds local midnight on the days the clocks change", () => {
    expect(iso(startOfDay(new Date("2026-03-08T15:00:00Z"), NY))).toBe("2026-03-08T05:00:00.000Z"); // spring forward
    expect(iso(startOfDay(new Date("2026-03-08T15:00:00Z"), NY, 1))).toBe("2026-03-09T04:00:00.000Z");
    expect(iso(startOfDay(new Date("2026-11-01T15:00:00Z"), NY))).toBe("2026-11-01T04:00:00.000Z"); // fall back
    expect(iso(startOfDay(new Date("2026-11-01T15:00:00Z"), NY, 1))).toBe("2026-11-02T05:00:00.000Z");
  });
  it("treats late evening in New York as the same local day even though UTC has rolled over", () => {
    const lateSaturday = new Date("2026-10-04T02:30:00Z"); // Sat 10:30 pm EDT
    expect(zonedParts(lateSaturday, NY)).toMatchObject({ d: 3, dow: 5 });
    expect(iso(weekStart(lateSaturday, NY))).toBe("2026-09-28T04:00:00.000Z");
    expect(iso(calendarDate(weekStart(lateSaturday, NY), NY))).toBe("2026-09-28T00:00:00.000Z");
  });
  it("keeps week windows on local Mondays across the fall-back week", () => {
    const w = rangeWindow("last", new Date("2026-11-04T17:00:00Z"), NY);
    expect([iso(w.from), iso(w.to)]).toEqual(["2026-10-26T04:00:00.000Z", "2026-11-02T05:00:00.000Z"]); // a 169-hour week
    const m = rangeWindow("month", new Date("2026-10-03T13:00:00Z"), NY);
    expect([iso(m.from), iso(m.to)]).toEqual(["2026-09-07T04:00:00.000Z", "2026-10-05T04:00:00.000Z"]);
  });
});

describe("labels", () => {
  it("names the Monday the next brief lands — a week out when today is Monday", () => {
    expect(nextBriefLabel(new Date("2026-10-03T13:00:00Z"), NY)).toBe("Monday, Oct 5");
    expect(nextBriefLabel(new Date("2026-10-05T13:00:00Z"), NY)).toBe("Monday, Oct 12");
  });
  it("formats a week as the design does", () => {
    expect(rangeLabel(new Date("2026-09-21T04:00:00Z"), new Date("2026-09-28T04:00:00Z"), NY)).toBe("SEP 21–27");
    expect(rangeLabel(new Date("2026-09-28T04:00:00Z"), new Date("2026-10-05T04:00:00Z"), NY)).toBe("SEP 28–OCT 4");
  });
});
