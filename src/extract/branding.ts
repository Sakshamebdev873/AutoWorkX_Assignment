import * as cheerio from "cheerio";
import type { PageSnapshot } from "../types.js";

export interface Branding {
  logo: string | null;
  favicon: string | null;
}

function resolve(url: string, base: string): string | null {
  try {
    return new URL(url, base).toString();
  } catch {
    return null;
  }
}

export function extractBranding(snapshots: PageSnapshot[]): Branding {
  const home = snapshots.find((s) => s.category === "home") ?? snapshots[0] ?? null;
  if (!home?.html) return { logo: null, favicon: null };

  const $ = cheerio.load(home.html);
  const base = home.url;

  let logo: string | null = null;
  const ogImage = $('meta[property="og:image"]').attr("content");
  if (ogImage) logo = resolve(ogImage, base);

  if (!logo) {
    const logoImg = $("img[src], img[srcset]")
      .filter((_, el) => {
        const hint = `${$(el).attr("src") ?? ""} ${$(el).attr("alt") ?? ""} ${$(el).attr("class") ?? ""}`.toLowerCase();
        return hint.includes("logo");
      })
      .first();
    const src = logoImg.attr("src");
    if (src) logo = resolve(src, base);
  }

  const iconHref = $('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]').first().attr("href");
  const favicon = iconHref ? resolve(iconHref, base) : resolve("/favicon.ico", base);

  return { logo, favicon };
}
