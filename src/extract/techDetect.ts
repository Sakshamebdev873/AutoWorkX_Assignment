import { TECH_SIGNATURES } from "../data/techSignatures.js";
import type { PageSnapshot } from "../types.js";

export interface DetectedTech {
  name: string;
  category: string;
}

/** Matches captured HTML/headers/cookies across all crawled pages against the curated fingerprint list. */
export function detectTechnologies(snapshots: PageSnapshot[]): DetectedTech[] {
  const found = new Map<string, DetectedTech>();

  const combinedHtml = snapshots.map((s) => s.html).join("\n").toLowerCase();
  const combinedHeaders = snapshots
    .flatMap((s) => Object.entries(s.headers).map(([k, v]) => `${k}: ${v}`))
    .join("\n")
    .toLowerCase();
  const combinedCookies = snapshots.flatMap((s) => s.cookies).join(" ").toLowerCase();

  for (const sig of TECH_SIGNATURES) {
    const htmlHit = sig.htmlPatterns?.some((p) => combinedHtml.includes(p.toLowerCase())) ?? false;
    const headerHit = sig.headerPatterns?.some((p) => combinedHeaders.includes(p.toLowerCase())) ?? false;
    const cookieHit = sig.cookiePatterns?.some((p) => combinedCookies.includes(p.toLowerCase())) ?? false;

    if (htmlHit || headerHit || cookieHit) {
      found.set(sig.name, { name: sig.name, category: sig.category });
    }
  }

  return [...found.values()];
}
