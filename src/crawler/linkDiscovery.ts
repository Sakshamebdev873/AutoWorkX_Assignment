import * as cheerio from "cheerio";
import type { DiscoveredLink } from "../types.js";

/**
 * Parses anchors out of already-rendered HTML (captured post-navigation, after the humanize scroll pass)
 * rather than re-querying a live Page — keeps this pure/testable and avoids a second navigation.
 */
export function discoverLinks(html: string, baseUrl: string): DiscoveredLink[] {
  const $ = cheerio.load(html);
  const links: DiscoveredLink[] = [];

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    try {
      const resolved = new URL(href, baseUrl).toString();
      links.push({ url: resolved, text: $(el).text().trim() });
    } catch {
      // unparseable href (stray javascript:/data: schemes etc.) — skip
    }
  });

  return links;
}
