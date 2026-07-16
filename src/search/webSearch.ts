import * as cheerio from "cheerio";
import type { Logger } from "pino";
import { DEFAULT_CONFIG } from "../config.js";

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

const SEARCH_ENDPOINT = "https://html.duckduckgo.com/html/";

/** DuckDuckGo's HTML results wrap every link in a `//duckduckgo.com/l/?uddg=<encoded-target>` click-tracking
 *  redirect rather than linking directly — unwrap it so callers get the real destination URL. */
function unwrapRedirect(href: string): string {
  try {
    const absolute = href.startsWith("//") ? `https:${href}` : href;
    const parsed = new URL(absolute);
    const target = parsed.searchParams.get("uddg");
    return target ? decodeURIComponent(target) : absolute;
  } catch {
    return href;
  }
}

/**
 * Parses DuckDuckGo's no-JS HTML results page. Kept separate from the network call so it's unit-testable
 * against a saved fixture. Fragile by nature (scrapes a third party's markup, no official API/key) — if
 * DuckDuckGo changes their result markup this silently returns fewer/no results rather than throwing,
 * consistent with every other best-effort bonus stage in this pipeline.
 */
export function parseSearchResults(html: string, limit = 5): WebSearchResult[] {
  const $ = cheerio.load(html);
  const results: WebSearchResult[] = [];

  $(".result").each((_, el) => {
    if (results.length >= limit) return;
    const anchor = $(el).find(".result__a").first();
    const title = anchor.text().trim();
    const href = anchor.attr("href");
    const snippet = $(el).find(".result__snippet").first().text().trim();
    if (title && href) {
      results.push({ title, url: unwrapRedirect(href), snippet });
    }
  });

  return results;
}

/**
 * Optional bonus stage: looks up the company on the web for context beyond their own site (news mentions,
 * third-party profiles, etc). Gated behind --web-search; any failure (network, blocking, markup change)
 * degrades to an empty array rather than breaking the run.
 */
export async function searchCompanyInfo(query: string, logger: Logger): Promise<WebSearchResult[]> {
  try {
    const url = `${SEARCH_ENDPOINT}?q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      headers: { "User-Agent": DEFAULT_CONFIG.userAgent },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      logger.warn({ status: response.status }, "web search request failed");
      return [];
    }

    const html = await response.text();
    const results = parseSearchResults(html);
    logger.info({ count: results.length }, "web search complete");
    return results;
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "web search failed — continuing without it");
    return [];
  }
}
