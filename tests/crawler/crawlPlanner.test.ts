import { describe, expect, it } from "vitest";
import { planCrawl } from "../../src/crawler/crawlPlanner.js";

describe("planCrawl", () => {
  const base = "https://acme.com/";

  it("keeps only same-origin, keyword-matching links, one per category, capped to maxPages", () => {
    const links = [
      { url: "https://acme.com/about-us", text: "About Us" },
      { url: "https://acme.com/about-us-2", text: "About Us (duplicate category)" },
      { url: "https://acme.com/contact", text: "Contact" },
      { url: "https://other.com/about", text: "About" },
      { url: "https://acme.com/logo.png", text: "" },
      { url: "https://acme.com/random-page", text: "Nothing relevant" },
    ];
    const plan = planCrawl(base, links, 8);
    const categories = plan.map((p) => p.category);
    expect(categories).toContain("about");
    expect(categories).toContain("contact");
    expect(categories.filter((c) => c === "about")).toHaveLength(1);
    expect(plan.every((p) => p.url.startsWith("https://acme.com"))).toBe(true);
  });

  it("does not mis-score a long marketing blurb just because it contains a keyword", () => {
    // Regression: a customer-story card whose blurb happens to mention "product" should not outrank the
    // real Products nav link — only short, nav-label-length link text should count toward scoring.
    const links = [
      {
        url: "https://acme.com/customers/openai",
        text: "OpenAI uses our product to ship faster across every team and every product line, globally.",
      },
      { url: "https://acme.com/products", text: "Products" },
    ];
    const plan = planCrawl(base, links, 8);
    const productsPage = plan.find((p) => p.category === "products");
    expect(productsPage?.url).toBe("https://acme.com/products");
  });

  it("excludes dated blog/changelog permalinks even if a keyword appears in the slug", () => {
    // Regression: /changelog/2026-06-04-team-documents used to be mis-scored as the Team page purely
    // because "team" appears as an incidental slug fragment.
    const links = [
      { url: "https://acme.com/changelog/2026-06-04-team-documents", text: "Team documents are here" },
      { url: "https://acme.com/team", text: "Team" },
    ];
    const plan = planCrawl(base, links, 8);
    const teamPage = plan.find((p) => p.category === "team");
    expect(teamPage?.url).toBe("https://acme.com/team");
  });

  it("respects the maxPages cap", () => {
    const links = [
      { url: "https://acme.com/about", text: "About" },
      { url: "https://acme.com/contact", text: "Contact" },
      { url: "https://acme.com/products", text: "Products" },
      { url: "https://acme.com/services", text: "Services" },
    ];
    const plan = planCrawl(base, links, 2);
    expect(plan).toHaveLength(2);
  });
});
