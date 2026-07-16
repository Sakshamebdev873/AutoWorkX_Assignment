import { describe, expect, it } from "vitest";
import { extractCompanyInfo } from "../../src/extract/companyInfo.js";
import { fakeSnapshot } from "../helpers/snapshot.js";

describe("extractCompanyInfo", () => {
  it("prefers JSON-LD Organization data when present", () => {
    const html = `
      <html><head>
        <title>Acme | Home</title>
        <script type="application/ld+json">
          {"@type": "Organization", "name": "Acme Corp", "description": "We build widgets.",
           "address": {"streetAddress": "1 Main St", "addressLocality": "Springfield", "addressRegion": "IL", "addressCountry": "US"}}
        </script>
      </head><body><h1>Welcome</h1></body></html>`;
    const info = extractCompanyInfo([fakeSnapshot({ html, category: "home", url: "https://acme.com/" })]);
    expect(info.name).toBe("Acme Corp");
    expect(info.description).toBe("We build widgets.");
    expect(info.headquarters).toContain("Springfield");
  });

  it("falls back to meta tags and title when no JSON-LD is present", () => {
    const html = `
      <html><head>
        <title>Beta Inc | Cloud Software</title>
        <meta name="description" content="Beta Inc is a SaaS company building cloud platform tools for teams." />
      </head><body><h1>Beta Inc</h1></body></html>`;
    const info = extractCompanyInfo([fakeSnapshot({ html, category: "home", url: "https://beta.io/" })]);
    expect(info.name).toBe("Beta Inc");
    expect(info.description).toContain("SaaS");
    expect(info.industry).toBe("Software / SaaS");
  });

  it("returns nulls gracefully when a page failed to load", () => {
    const info = extractCompanyInfo([fakeSnapshot({ html: "", category: "home", ok: false })]);
    expect(info.name).toBeNull();
    expect(info.description).toBeNull();
  });
});
