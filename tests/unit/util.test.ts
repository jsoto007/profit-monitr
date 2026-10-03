import { describe, expect, it } from "vitest";
import { rateLimit, resetRateLimits } from "@/lib/rate-limit";
import { deltaLabel, formatCard, formatExpiry, money, moneyExact, parseDollars, passwordScore, pct, slugify } from "@/lib/util";
import { validateStep, EMPTY_SIGNUP } from "@/lib/validation";

describe("formatting", () => {
  it("slugifies venue names the way tracked links show them", () => {
    expect(slugify("The Copper Room")).toBe("the-copper-room");
    expect(slugify("Test Kitchen & Bar")).toBe("test-kitchen-bar");
    expect(slugify("A Very Long Venue Name Indeed")).toBe("a-very-long-venue");
    expect(slugify("  ")).toBe("venue");
  });
  it("shows cents as whole dollars", () => {
    expect(money(4_892_000)).toBe("$48,920");
    expect(money(21_240)).toBe("$212");
    expect(money(0)).toBe("$0");
  });
  it("clamps bar percentages", () => {
    expect(pct(0.456)).toBe("45.6%");
    expect(pct(2)).toBe("100.0%");
    expect(pct(NaN)).toBe("0.0%");
  });
  it("labels deltas only when there is a baseline", () => {
    expect(deltaLabel(118, 100)).toBe("+18%");
    expect(deltaLabel(97, 100)).toBe("−3%");
    expect(deltaLabel(5, 0)).toBe("");
  });
});

describe("parseDollars — money never passes through a float", () => {
  it.each([["84.50", 8450], ["84.5", 8450], ["84", 8400], ["$1,204.09", 120409], ["0.07", 7], [19.99, 1999]])("%s → %i cents", (input, cents) => {
    expect(parseDollars(input)).toBe(cents);
  });
  it.each(["", "abc", "-5", "1.234", "1e3", "12.3.4", "1000000", 0.1 + 0.2, null, undefined])("rejects %s", (input) => {
    expect(parseDollars(input)).toBeNull();
  });
  // A comma decimal mark must never be read as a thousands separator (184,50 is not $18,450).
  it.each(["184,50", "1,00", "12,5", ",5", "1,2345", "12,34,567", "1,000,000"])("refuses the ambiguous comma in %s", (input) => {
    expect(parseDollars(input)).toBeNull();
  });
  it("accepts well-formed thousands separators", () => {
    expect(parseDollars("12,345.6")).toBe(1_234_560);
    expect(parseDollars("999,999.99")).toBe(99_999_999);
  });
  it("formats exact cents where money is entered or owed", () => {
    expect([moneyExact(18_450), moneyExact(1_250), moneyExact(5), moneyExact(120_409_00)]).toEqual(["$184.50", "$12.50", "$0.05", "$120,409.00"]);
  });
});

describe("sign-up helpers", () => {
  it("scores password strength 0–4", () => {
    expect(passwordScore("")).toBe(0);
    expect(passwordScore("abc")).toBe(1);
    expect(passwordScore("abcdefgh")).toBe(1);
    expect(passwordScore("Abcdefgh")).toBe(2);
    expect(passwordScore("Abcdefg1")).toBe(3);
    expect(passwordScore("Abcdef1!")).toBe(4);
  });
  it("groups the card number and expiry as typed", () => {
    expect(formatCard("4242424242424242999")).toBe("4242 4242 4242 4242");
    expect(formatCard("4242-42")).toBe("4242 42");
    expect(formatExpiry("1230")).toBe("12/30");
    expect(formatExpiry("1")).toBe("1");
  });
  it("validates each step with the handoff's messages", () => {
    expect(validateStep(1, EMPTY_SIGNUP)).toEqual({ name: "Please enter your name.", email: "Enter a valid email.", password: "Use at least 8 characters." });
    expect(validateStep(2, { ...EMPTY_SIGNUP, sells: [] })).toEqual({ venue: "What is your venue called?", city: "Which city?", sells: "Pick at least one." });
    expect(validateStep(3, EMPTY_SIGNUP)).toEqual({ cardName: "Name as it appears on the card.", card: "Enter a 16-digit card number.", exp: "MM/YY", cvc: "3–4 digits", zip: "Required", agree: "Please agree to continue." });
    // With a hosted payment form only the consent is ours to check.
    expect(validateStep(3, EMPTY_SIGNUP, false)).toEqual({ agree: "Please agree to continue." });
    expect(validateStep(3, { ...EMPTY_SIGNUP, cardName: "Dana Test", card: "4242 4242 4242 4242", exp: "12/30", cvc: "123", zip: "11201", agree: true })).toEqual({});
  });
});

describe("rateLimit", () => {
  it("allows up to max per window, then refuses until the window passes", () => {
    resetRateLimits();
    for (let i = 0; i < 3; i++) rateLimit("k", 3, 1000, 0);
    expect(() => rateLimit("k", 3, 1000, 500)).toThrow(/Too many attempts/);
    expect(() => rateLimit("k", 3, 1000, 1001)).not.toThrow();
  });
});
