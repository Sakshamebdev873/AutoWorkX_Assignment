import * as cheerio from "cheerio";
import { SOCIAL_DOMAINS } from "../data/socialDomains.js";
import type { PageSnapshot, SocialLinks } from "../types.js";

const NON_PROFILE_PATHS = /\/(sharer|share|intent|login|dialog|plugins)\b/i;

export function extractSocialLinks(snapshots: PageSnapshot[]): SocialLinks {
  const found: Partial<Record<keyof SocialLinks, string>> = {};

  for (const snap of snapshots) {
    if (!snap.html) continue;
    const $ = cheerio.load(snap.html);

    $("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      if (!href) return;

      let parsed: URL;
      try {
        parsed = new URL(href, snap.url);
      } catch {
        return;
      }

      const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
      for (const [platform, domains] of Object.entries(SOCIAL_DOMAINS) as [keyof SocialLinks, string[]][]) {
        if (found[platform]) continue;
        if (!domains.some((d) => host === d || host.endsWith(`.${d}`))) continue;
        if (NON_PROFILE_PATHS.test(parsed.pathname)) continue;
        found[platform] = parsed.toString();
      }
    });
  }

  return {
    linkedin: found.linkedin ?? null,
    twitter: found.twitter ?? null,
    facebook: found.facebook ?? null,
    instagram: found.instagram ?? null,
    github: found.github ?? null,
    youtube: found.youtube ?? null,
  };
}
