import { PRIORITY_PAGES } from "../config.js";
import type { DiscoveredLink } from "../types.js";

export interface PlannedPage {
  url: string;
  category: string;
  score: number;
}

const NON_HTML_EXTENSIONS = /\.(pdf|jpg|jpeg|png|gif|svg|zip|mp4|webp|ico|css|js|xml|json)$/i;

/** Blog/changelog permalinks (e.g. /changelog/2026-06-04-team-documents) commonly embed a priority-page
 *  keyword as an incidental slug fragment. They're individual articles, not site sections, so they're
 *  excluded from priority-page scoring entirely rather than risk mislabeling one as e.g. the Team page. */
const DATED_SLUG = /\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b/;

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
      u.pathname = u.pathname.slice(0, -1);
    }
    return u.toString();
  } catch {
    return url;
  }
}

/** Nav items are short ("About", "Contact Us"); long anchor text is usually marketing copy inside a card
 *  or blurb, and matching keywords against it produces false hits (e.g. a customer-story blurb that happens
 *  to mention "product" getting mis-scored as the Products page). URL path is always trustworthy; link text
 *  is only trusted when it's short enough to plausibly be a nav label. */
const NAV_LABEL_MAX_LENGTH = 30;

function bestCategoryMatch(link: DiscoveredLink): { category: string; score: number } | null {
  let urlPath = "";
  try {
    urlPath = new URL(link.url).pathname.toLowerCase();
  } catch {
    urlPath = link.url.toLowerCase();
  }
  const navText = link.text.length > 0 && link.text.length <= NAV_LABEL_MAX_LENGTH ? link.text.toLowerCase() : "";
  const haystack = `${urlPath} ${navText}`;

  let best: { category: string; score: number } | null = null;
  for (const rule of PRIORITY_PAGES) {
    const hit = rule.keywords.some((kw) => haystack.includes(kw));
    if (hit && (!best || rule.weight > best.score)) {
      best = { category: rule.category, score: rule.weight };
    }
  }

  return best;
}

/**
 * Builds the depth-1 crawl plan: same-origin links only, deduped, scored against priority-page keywords,
 * with at most one page kept per category (so e.g. multiple "Contact" links collapse to the best match),
 * capped to maxPages.
 */
export function planCrawl(baseUrl: string, links: DiscoveredLink[], maxPages: number): PlannedPage[] {
  const base = new URL(baseUrl);
  const baseHost = base.hostname.replace(/^www\./, "");
  const seen = new Set<string>([normalizeUrl(baseUrl)]);
  const scored: PlannedPage[] = [];

  for (const link of links) {
    let parsed: URL;
    try {
      parsed = new URL(link.url);
    } catch {
      continue;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") continue;
    if (parsed.hostname.replace(/^www\./, "") !== baseHost) continue;
    if (NON_HTML_EXTENSIONS.test(parsed.pathname)) continue;
    if (DATED_SLUG.test(parsed.pathname)) continue;

    const normalized = normalizeUrl(parsed.toString());
    if (seen.has(normalized)) continue;

    const match = bestCategoryMatch(link);
    if (!match) continue;

    seen.add(normalized);
    scored.push({ url: normalized, category: match.category, score: match.score });
  }

  scored.sort((a, b) => b.score - a.score);

  const byCategory = new Map<string, PlannedPage>();
  for (const page of scored) {
    if (!byCategory.has(page.category)) byCategory.set(page.category, page);
  }

  return [...byCategory.values()].slice(0, maxPages);
}
