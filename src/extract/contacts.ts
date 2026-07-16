import * as cheerio from "cheerio";
import type { Contacts, PageSnapshot } from "../types.js";

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
// Requires at least one separator between digit groups to avoid matching arbitrary long digit runs (prices, IDs, years).
const PHONE_REGEX = /(\+\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]\d{2,4}[\s.-]\d{2,9}(?:[\s.-]\d{2,4})?/g;

const IGNORED_EMAIL_DOMAINS = ["example.com", "sentry.io", "wixpress.com", "godaddy.com"];

const DEPARTMENT_PREFIXES: Record<string, string[]> = {
  sales: ["sales@"],
  support: ["support@", "help@", "helpdesk@"],
  careers: ["careers@", "jobs@", "hr@", "recruiting@"],
  press: ["press@", "media@", "pr@"],
  general: ["info@", "hello@", "contact@"],
};

function isPlausibleEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  if (IGNORED_EMAIL_DOMAINS.some((d) => domain.includes(d))) return false;
  if (/\.(png|jpg|jpeg|gif|svg|webp)$/i.test(email)) return false;
  return true;
}

function isPlausiblePhone(candidate: string): boolean {
  // 10+ digits cuts down false positives from coincidental number runs in free text (a copyright year
  // butted up against a decimal price, product IDs, etc.) at the cost of missing some short local numbers —
  // an acceptable heuristic tradeoff, documented as a known limitation.
  const digits = candidate.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

/**
 * cheerio's plain `.text()` concatenates text from separate block-level elements with no separator
 * (e.g. two stacked <div>s render as one run-on string), which corrupts regex matches like emails/phones
 * that happen to span an element boundary. Joining each text node with a space avoids that.
 */
function spacedBodyText($: cheerio.CheerioAPI): string {
  const parts: string[] = [];
  $("body")
    .find("*")
    .addBack()
    .contents()
    .each((_, node) => {
      if (node.type === "text") {
        const t = $(node).text().trim();
        if (t) parts.push(t);
      }
    });
  return parts.join(" ");
}

export function extractContacts(snapshots: PageSnapshot[]): Contacts {
  const emails = new Set<string>();
  const phones = new Set<string>();
  const contactForms = new Set<string>();

  for (const snap of snapshots) {
    if (!snap.html) continue;
    const $ = cheerio.load(snap.html);
    const text = spacedBodyText($);

    for (const match of text.matchAll(EMAIL_REGEX)) {
      if (isPlausibleEmail(match[0])) emails.add(match[0].toLowerCase());
    }
    $('a[href^="mailto:"]').each((_, el) => {
      const addr = ($(el).attr("href") ?? "").replace("mailto:", "").split("?")[0]?.trim();
      if (addr && isPlausibleEmail(addr)) emails.add(addr.toLowerCase());
    });

    $('a[href^="tel:"]').each((_, el) => {
      const num = ($(el).attr("href") ?? "").replace("tel:", "").trim();
      if (num && isPlausiblePhone(num)) phones.add(num);
    });
    for (const match of text.matchAll(PHONE_REGEX)) {
      const candidate = match[0].trim();
      if (isPlausiblePhone(candidate)) phones.add(candidate);
    }

    $("form").each((_, form) => {
      const hasTextualInput = $(form).find('input[type="email"], input[type="text"], textarea').length > 0;
      if (hasTextualInput) contactForms.add(snap.url);
    });
  }

  const departmentContacts = Object.entries(DEPARTMENT_PREFIXES)
    .map(([department, prefixes]) => ({
      department,
      email: [...emails].find((e) => prefixes.some((p) => e.startsWith(p))) ?? null,
      phone: null,
    }))
    .filter((d) => d.email !== null);

  return {
    emails: [...emails].slice(0, 25),
    phones: [...phones].slice(0, 15),
    contactForms: [...contactForms],
    departmentContacts,
  };
}
