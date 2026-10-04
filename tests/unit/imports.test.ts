import { describe, expect, it } from "vitest";
import { csvLine, parseCsv } from "@/lib/csv";
import { attribute, findColumns, parseExport, parseMoneyCell, parseWhen } from "@/lib/imports";

const NY = "America/New_York";

describe("csv", () => {
  it("reads quoted cells, doubled quotes, embedded line breaks, CRLF and a byte-order mark", () => {
    const text = '﻿a,b,c\r\n1,"two, with comma","he said ""hi"""\r\n"multi\nline",,\r\n';
    expect(parseCsv(text)).toEqual([["a", "b", "c"], ["1", "two, with comma", 'he said "hi"'], ["multi\nline", "", ""]]);
    expect(parseCsv("")).toEqual([]);
    expect(parseCsv("x\n\n\n")).toEqual([["x"]]);
    expect(csvLine(["a", 'b "q"', "c,d", 7])).toBe('a,"b ""q""","c,d",7');
  });
});

describe("platform date and money cells", () => {
  it("reads the common export date formats as the venue's wall clock", () => {
    const iso = (d: Date | null) => d?.toISOString();
    expect(iso(parseWhen("2026-09-26 19:05", "", NY))).toBe("2026-09-26T23:05:00.000Z"); // EDT
    expect(iso(parseWhen("2026-09-26", "7:05 PM", NY))).toBe("2026-09-26T23:05:00.000Z");
    expect(iso(parseWhen("9/26/2026 7:05 PM", "", NY))).toBe("2026-09-26T23:05:00.000Z");
    expect(iso(parseWhen("Sep 26, 2026", "", NY))).toBe("2026-09-26T04:00:00.000Z");
    expect(iso(parseWhen("26 Sep 2026 12:30am", "", NY))).toBe("2026-09-26T04:30:00.000Z");
    expect(iso(parseWhen("2026-09-26T19:05:00Z", "", NY))).toBe("2026-09-26T19:05:00.000Z"); // carries its own zone
    expect(iso(parseWhen("2026-12-26 19:05", "", NY))).toBe("2026-12-27T00:05:00.000Z"); // EST
    expect(parseWhen("2026-02-31", "", NY)).toBeNull(); // not quietly Mar 3
    expect(parseWhen("yesterday", "", NY)).toBeNull();
    expect(parseWhen("", "", NY)).toBeNull();
    expect(parseWhen("2026-09-26 25:00", "", NY)).toBeNull();
  });

  it("reads money as integer cents and refunds as negatives, never as floats", () => {
    expect(parseMoneyCell("$1,204.50")).toBe(120_450);
    expect(parseMoneyCell("USD 30.00")).toBe(3_000);
    expect(parseMoneyCell("(12.00)")).toBe(-1_200);
    expect(parseMoneyCell("-12")).toBe(-1_200);
    expect(parseMoneyCell("")).toBe(0);
    expect(parseMoneyCell("0.1")).toBe(10);
    expect(parseMoneyCell("12,50")).toBeNull(); // comma decimal is refused, not read as $1,250
    expect(parseMoneyCell("abc")).toBeNull();
  });
});

describe("platform exports", () => {
  const channels = [
    { id: "c1", code: "INSTA", slug: "ig", name: "Instagram" },
    { id: "c2", code: "EMAIL", slug: "email", name: "Email" },
    { id: "c3", code: "LEO", slug: "promoter-leo", name: "Promoter · Leo R." },
  ];

  it("reads an Eventbrite-style orders report", () => {
    const text = [
      "Order #,Order Date,First Name,Last Name,Email,Quantity,Total Paid,Order Status,Promo Code,Affiliate,Event Name,Event Date,Checked In",
      '1001,"Sep 26, 2026 7:05 PM",Ana,Guest,ana@x.test,2,$60.00,Attending,insta,,Jazz Night,2026-10-03 21:00,No',
      "1002,2026-09-26 20:10,Bo,Guest,bo@x.test,1,40.00,Attending,,promoter-leo,Jazz Night,2026-10-03 21:00,Yes",
      "1003,2026-09-27 09:00,Cy,Guest,cy@x.test,1,25.00,Attending,,,Jazz Night,2026-10-03 21:00,",
      "1004,2026-09-27 09:30,Di,Guest,di@x.test,1,15.00,Refunded,INSTA,,Jazz Night,2026-10-03 21:00,No",
      "1004,2026-09-28 09:30,Di,Guest,di@x.test,1,(15.00),Refund,INSTA,,Jazz Night,2026-10-03 21:00,No",
      "oops,not a date,X,Y,x@y.test,1,10.00,Attending,,,,,",
      ",2026-09-27 09:00,No,Id,n@x.test,1,10.00,Attending,,,,,",
    ].join("\n");
    const p = parseExport(text, "eventbrite", NY);
    expect(p.missing).toEqual([]);
    expect(p.rejects).toEqual([{ line: 7, reason: 'unreadable date "not a date"' }, { line: 8, reason: "no order id" }]);
    expect(p.rows.map((r) => [r.externalId, r.amountCents, r.refunded, r.promoCode, r.tracking, r.checkedIn, r.quantity])).toEqual([
      ["1001", 6_000, false, "INSTA", "", false, 2],
      ["1002", 4_000, false, "", "promoter-leo", true, 1],
      ["1003", 2_500, false, "", "", false, 1],
      ["1004", 0, true, "INSTA", "", false, 1], // the refund line for the same order wins
    ]);
    expect(p.rows[0].orderedAt.toISOString()).toBe("2026-09-26T23:05:00.000Z");
    expect(p.rows[0].eventStartsAt?.toISOString()).toBe("2026-10-04T01:00:00.000Z");
    expect(p.rows[0].guestName).toBe("Ana Guest");
    expect(p.rows.map((r) => attribute(r, channels)?.code ?? null)).toEqual(["INSTA", "LEO", null, "INSTA"]);
  });

  it("reads a Posh-style event report and matches tracking links by name", () => {
    const text = ["Order ID,Date,Name,Email,Tickets,Total,Promo Code,Tracking Link,Status", "P-1,2026-09-26 22:00,Ana Guest,ana@x.test,3,$90.00,,Promoter · Leo R.,Paid", "P-2,2026-09-26 22:30,Bo Guest,bo@x.test,1,$30.00,,,Cancelled"].join("\n");
    const p = parseExport(text, "posh", NY);
    expect(p.rows.map((r) => [r.externalId, r.quantity, r.amountCents, r.refunded, attribute(r, channels)?.code ?? null])).toEqual([["P-1", 3, 9_000, false, "LEO"], ["P-2", 1, 0, true, null]]);
    expect(p.rows[0].eventExternalId).toBe(""); // no event column: orders hang off no event
  });

  it("reads an OpenTable-style reservations export: seated means arrived, no money is implied", () => {
    const text = ["Confirmation Number,Date,Time,Guest Name,Email,Party Size,Source,Campaign Name,Status", "R-77,09/26/2026,7:30 PM,Ana Guest,ana@x.test,4,Instagram,,Seated", "R-78,09/26/2026,8:00 PM,Bo Guest,bo@x.test,2,,,No-show"].join("\n");
    const p = parseExport(text, "opentable", NY);
    expect(p.rows.map((r) => [r.externalId, r.quantity, r.amountCents, r.checkedIn, r.refunded, attribute(r, channels)?.code ?? null])).toEqual([["R-77", 4, 0, true, false, "INSTA"], ["R-78", 2, 0, false, true, null]]);
    expect(p.rows[0].orderedAt.toISOString()).toBe("2026-09-26T23:30:00.000Z");
  });

  it("names the columns it cannot find instead of guessing", () => {
    const p = parseExport("Buyer,Amount\nAna,10", "posh", NY);
    expect(p.missing).toEqual(["id", "date"]);
    expect(p.rows).toEqual([]);
    expect(findColumns(["Order #", "Order Date", "Email"])).toEqual({ id: 0, date: 1, email: 2 });
    expect(parseExport("", "posh", NY).missing).toEqual(["id", "date"]);
  });
});
