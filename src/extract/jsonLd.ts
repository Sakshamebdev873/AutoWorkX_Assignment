import * as cheerio from "cheerio";

/** Best-effort extraction of a schema.org Organization/Corporation/LocalBusiness node from a page's JSON-LD blocks. */
export function extractJsonLdOrganization(html: string): Record<string, unknown> | null {
  const $ = cheerio.load(html);
  const scripts = $('script[type="application/ld+json"]');

  for (let i = 0; i < scripts.length; i++) {
    const raw = $(scripts[i]).contents().text();
    if (!raw?.trim()) continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }

    const roots = Array.isArray(parsed) ? parsed : [parsed];
    for (const root of roots) {
      if (!root || typeof root !== "object") continue;
      const graph = (root as Record<string, unknown>)["@graph"];
      const nodes = Array.isArray(graph) ? graph : [root];

      for (const node of nodes) {
        if (!node || typeof node !== "object") continue;
        const type = (node as Record<string, unknown>)["@type"];
        const types = Array.isArray(type) ? type : [type];
        if (types.includes("Organization") || types.includes("Corporation") || types.includes("LocalBusiness")) {
          return node as Record<string, unknown>;
        }
      }
    }
  }

  return null;
}
