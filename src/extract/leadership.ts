import * as cheerio from "cheerio";
import type { LeadershipMember, PageSnapshot } from "../types.js";

const TITLE_KEYWORDS = [
  "ceo",
  "chief executive",
  "cto",
  "chief technology",
  "cfo",
  "chief financial",
  "coo",
  "chief operating",
  "founder",
  "co-founder",
  "president",
  "director",
  "vice president",
  "head of",
  "managing director",
];

function looksLikeTitle(text: string): boolean {
  if (text.length === 0 || text.length > 60) return false;
  const lower = text.toLowerCase();
  return TITLE_KEYWORDS.some((kw) => lower.includes(kw));
}

function looksLikeName(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 3 || trimmed.length > 45) return false;
  const words = trimmed.split(/\s+/);
  if (words.length < 2 || words.length > 4) return false;
  return words.every((w) => /^[A-Z][a-zA-Z.'-]*$/.test(w));
}

/**
 * Heuristic name+title pairing over Team/About pages: for each name-shaped heading/bold element, looks for a
 * nearby sibling text node that reads like an exec title. Best-effort — layout-dependent, will miss sites
 * that render team cards via client-side JS the crawler doesn't wait long enough for.
 */
export function extractLeadership(snapshots: PageSnapshot[]): LeadershipMember[] {
  const pages = snapshots.filter((s) => (s.category === "team" || s.category === "about") && s.html);
  const results: LeadershipMember[] = [];
  const seen = new Set<string>();

  for (const snap of pages) {
    const $ = cheerio.load(snap.html);

    $("h1, h2, h3, h4, strong, b").each((_, el) => {
      const candidateName = $(el).text().trim();
      if (!looksLikeName(candidateName) || seen.has(candidateName)) return;

      const container = $(el).closest("div, li, article, section");
      const titleText = container
        .find("p, span, div")
        .map((_, t) => $(t).text().trim())
        .get()
        .find((t) => looksLikeTitle(t));

      if (!titleText) return;

      seen.add(candidateName);
      const linkedinHref = container.find('a[href*="linkedin.com"]').first().attr("href");

      results.push({
        name: candidateName,
        title: titleText,
        linkedin: linkedinHref ? new URL(linkedinHref, snap.url).toString() : null,
        sourcePage: snap.url,
      });
    });
  }

  return results.slice(0, 20);
}
