import { describe, expect, it } from "vitest";
import { fidelityNote, hostMatches, normalizeDestination, ownHosts, providerOf, websiteHost, withTracking } from "@/lib/destinations";

describe("tracked-link destinations", () => {
  it("accepts a known platform or the venue's own site, in canonical https form", () => {
    expect(normalizeDestination("posh.vip/e/sunset-sessions", "")).toEqual({ url: "https://posh.vip/e/sunset-sessions", provider: "posh" });
    expect(normalizeDestination("  https://www.eventbrite.com/e/jazz-night-tickets-123 ", "")).toEqual({ url: "https://www.eventbrite.com/e/jazz-night-tickets-123", provider: "eventbrite" });
    expect(normalizeDestination("https://resy.com/cities/ny/venues/copper", "")).toMatchObject({ provider: "resy" });
    expect(normalizeDestination("https://www.opentable.com/r/copper-room", "")).toMatchObject({ provider: "opentable" });
    expect(normalizeDestination("https://partiful.com/e/abc", "")).toMatchObject({ provider: "partiful" });
    expect(normalizeDestination("https://WWW.TheCopperRoom.com/Book", "thecopperroom.com")).toEqual({ url: "https://www.thecopperroom.com/Book", provider: "website" });
    expect(normalizeDestination("", "")).toEqual({ url: "", provider: "native" });
  });

  it("refuses everything that would make the redirect an open relay", () => {
    const err = (raw: string, site = "", app: string[] = []) => {
      const n = normalizeDestination(raw, site, app);
      return "error" in n ? n.error : `ACCEPTED ${n.url}`;
    };
    expect(err("http://posh.vip/e/x")).toMatch(/https/);
    expect(err("javascript:alert(1)")).toMatch(/https/);
    expect(err("https://user:pw@posh.vip/e/x")).toMatch(/username/);
    expect(err("https://posh.vip.evil.com/e/x")).toMatch(/Links can point at/); // suffix spoof
    expect(err("https://evil.com/posh.vip")).toMatch(/Links can point at/);
    expect(err("https://evil.com", "thecopperroom.com")).toMatch(/thecopperroom\.com/); // names the allowed site
    expect(err("https://localhost/x")).toMatch(/full web address/);
    expect(err("https://profit-monitr.onrender.com/r/x/ig", "", ["profit-monitr.onrender.com"])).toMatch(/own address/);
    expect(err("https://app.monitr.link/x", "", ["monitr.link"])).toMatch(/own address/);
    expect(err(`https://posh.vip/${"a".repeat(600)}`)).toMatch(/too long/);
    expect(err("not a url at all")).toMatch(/full web address/);
  });

  it("carries the channel into Eventbrite's own attribution and leaves other links alone", () => {
    expect(withTracking("https://www.eventbrite.com/e/jazz-123", "ig")).toBe("https://www.eventbrite.com/e/jazz-123?aff=ig");
    expect(withTracking("https://www.eventbrite.com/e/jazz-123?aff=promoter-leo", "ig")).toBe("https://www.eventbrite.com/e/jazz-123?aff=promoter-leo"); // the pasted link wins
    expect(withTracking("https://posh.vip/e/sunset?t=abc", "ig")).toBe("https://posh.vip/e/sunset?t=abc");
    expect(withTracking("garbage", "ig")).toBe("garbage");
  });

  it("reads a venue's website as a bare host and matches subdomains only", () => {
    expect(websiteHost("thecopperroom.com")).toBe("thecopperroom.com");
    expect(websiteHost("https://www.x.com/menu?x=1")).toBe("www.x.com");
    expect(websiteHost("nope")).toBe("");
    expect(websiteHost("")).toBe("");
    expect(hostMatches("www.posh.vip", "posh.vip")).toBe(true);
    expect(hostMatches("posh.vip", "posh.vip")).toBe(true);
    expect(hostMatches("posh.vip.evil.com", "posh.vip")).toBe(false);
    expect(hostMatches("notposh.vip", "posh.vip")).toBe(false);
  });

  it("names the provider by host and describes what each fidelity can prove", () => {
    expect(providerOf("")).toBe("native");
    expect(providerOf("https://www.eventbrite.co.uk/e/x")).toBe("eventbrite");
    expect(providerOf("https://www.thecopperroom.com/book", "thecopperroom.com")).toBe("website");
    expect(fidelityNote("exact", "native")).toMatch(/measured/);
    expect(fidelityNote("clicks", "posh")).toBe("clicks only — bookings happen on Posh");
    expect(fidelityNote("platform", "eventbrite")).toMatch(/Eventbrite's export/);
  });

  it("knows its own hosts from the request and the configured origins", () => {
    const req = new Request("http://localhost/x", { headers: { host: "Profit-Monitr.onrender.com:10000" } });
    process.env.APP_URL = "https://www.example.com";
    expect(ownHosts(req)).toEqual(["profit-monitr.onrender.com", "www.example.com"]);
    delete process.env.APP_URL;
    expect(ownHosts()).toEqual([]);
  });
});
