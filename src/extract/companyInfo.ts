import * as cheerio from "cheerio";
import type { PageSnapshot } from "../types.js";
import { extractJsonLdOrganization } from "./jsonLd.js";

export interface CompanyInfo {
  name: string | null;
  description: string | null;
  industry: string | null;
  headquarters: string | null;
  locations: string[];
  products: string[];
  services: string[];
}

/** Small heuristic keyword dictionary — best-effort industry guess, not a taxonomy. */
const INDUSTRY_KEYWORDS: Record<string, string[]> = {
  "Software / SaaS": ["saas", "software as a service", "cloud platform", "api platform"],
  "E-commerce": ["e-commerce", "ecommerce", "online store", "shopping cart"],
  Healthcare: ["healthcare", "medical", "clinic", "patient care", "telehealth"],
  "Finance / Fintech": ["fintech", "banking", "payments platform", "financial services", "investment"],
  Education: ["edtech", "e-learning", "online courses", "education platform"],
  "Real Estate": ["real estate", "property management", "realty"],
  Manufacturing: ["manufacturing", "factory", "industrial equipment"],
  Marketing: ["marketing agency", "digital marketing", "advertising agency"],
  Logistics: ["logistics", "supply chain", "freight", "shipping solutions"],
  Consulting: ["consulting", "advisory services", "management consulting"],
  "AI / Machine Learning": ["artificial intelligence", "machine learning", "generative ai", " llm "],
};

function cleanTitle(title: string): string {
  return title.split(/[|\-–—:]/)[0]?.trim() || title.trim();
}

function guessIndustry(text: string): string | null {
  const lower = ` ${text.toLowerCase()} `;
  for (const [industry, keywords] of Object.entries(INDUSTRY_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) return industry;
  }
  return null;
}

function formatAddress(address: unknown): string | null {
  if (!address || typeof address !== "object") return null;
  const a = address as Record<string, unknown>;
  const parts = [a.streetAddress, a.addressLocality, a.addressRegion, a.postalCode, a.addressCountry]
    .filter((v): v is string => typeof v === "string" && v.length > 0);
  return parts.length ? parts.join(", ") : null;
}

function extractListSection(snapshots: PageSnapshot[], category: "products" | "services"): string[] {
  const page = snapshots.find((s) => s.category === category);
  if (!page?.html) return [];
  const $ = cheerio.load(page.html);
  const items = new Set<string>();

  $("h1, h2, h3").each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 2 && text.length < 80) items.add(text);
  });

  return [...items].slice(0, 15);
}

export function extractCompanyInfo(snapshots: PageSnapshot[]): CompanyInfo {
  const home = snapshots.find((s) => s.category === "home") ?? snapshots[0] ?? null;
  const about = snapshots.find((s) => s.category === "about") ?? null;
  const contact = snapshots.find((s) => s.category === "contact") ?? null;

  let name: string | null = null;
  let description: string | null = null;
  let headquarters: string | null = null;
  const locations = new Set<string>();

  for (const snap of [home, about]) {
    if (!snap?.html) continue;
    const org = extractJsonLdOrganization(snap.html);
    if (!org) continue;
    if (!name && typeof org.name === "string") name = org.name;
    if (!description && typeof org.description === "string") description = org.description;
    const addr = formatAddress(org.address);
    if (addr) {
      headquarters = headquarters ?? addr;
      locations.add(addr);
    }
  }

  if (home?.html) {
    const $ = cheerio.load(home.html);
    if (!name) {
      const ogSiteName = $('meta[property="og:site_name"]').attr("content")?.trim();
      const titleText = $("title").first().text();
      name = ogSiteName || (titleText ? cleanTitle(titleText) : null) || $("h1").first().text().trim() || null;
      if (name === "") name = null;
    }
    if (!description) {
      description =
        $('meta[name="description"]').attr("content")?.trim() ||
        $('meta[property="og:description"]').attr("content")?.trim() ||
        null;
    }
  }

  if (!description && about?.html) {
    const $ = cheerio.load(about.html);
    const paragraph = $("p")
      .map((_, el) => $(el).text().trim())
      .get()
      .find((t) => t.length > 60);
    description = paragraph ?? null;
  }

  if (!headquarters) {
    for (const snap of [contact, about]) {
      if (!snap?.html) continue;
      const $ = cheerio.load(snap.html);
      const addressTag = $("address").first().text().trim();
      if (addressTag) {
        headquarters = addressTag;
        locations.add(addressTag);
        break;
      }
    }
  }

  const industry = guessIndustry([description ?? "", home?.title ?? ""].join(" "));

  return {
    name,
    description,
    industry,
    headquarters,
    locations: [...locations],
    products: extractListSection(snapshots, "products"),
    services: extractListSection(snapshots, "services"),
  };
}
