import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { CompanyProfile } from "../types.js";

const ESCAPE_MAP: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (c) => ESCAPE_MAP[c] ?? c);
}

function toWebPath(outputDir: string, absolutePath: string): string {
  return path.relative(outputDir, absolutePath).split(path.sep).join("/");
}

/** Renders one self-contained static HTML report (no server needed) for the walkthrough-video demo. */
export async function renderDashboard(profile: CompanyProfile, outputDir: string): Promise<string> {
  const dashboardPath = path.join(outputDir, "dashboard.html");

  const screenshotCards = profile.pagesCrawled
    .filter((p) => p.screenshots.desktop)
    .map(
      (p) => `
      <div class="card">
        <h3>${escapeHtml(p.category)}</h3>
        <a href="${escapeHtml(p.url)}" target="_blank" rel="noopener">${escapeHtml(p.url)}</a>
        <img src="${escapeHtml(toWebPath(outputDir, p.screenshots.desktop as string))}" loading="lazy" alt="${escapeHtml(p.category)} screenshot" />
      </div>`,
    )
    .join("\n");

  const techBadges = profile.technologies
    .map((t) => `<span class="badge" title="${escapeHtml(t.category)}">${escapeHtml(t.name)}</span>`)
    .join(" ");

  const socialLinksHtml = Object.entries(profile.socialLinks)
    .filter((entry): entry is [string, string] => typeof entry[1] === "string")
    .map(([platform, url]) => `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(platform)}</a>`)
    .join(" &middot; ");

  const leadershipHtml = profile.leadership
    .map((l) => `<li><strong>${escapeHtml(l.name)}</strong> — ${escapeHtml(l.title)}</li>`)
    .join("\n");

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(profile.company.name ?? profile.meta.domain)} — Website Intelligence Report</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; max-width: 960px; margin: 2rem auto; padding: 0 1rem; line-height: 1.5; }
  h1 { margin-bottom: 0; }
  .muted { opacity: 0.65; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1rem; margin-top: 1rem; }
  .card { border: 1px solid #8884; border-radius: 8px; padding: 0.75rem; }
  .card img { width: 100%; border-radius: 4px; margin-top: 0.5rem; display: block; }
  .badge { display: inline-block; background: #6366f122; border: 1px solid #6366f155; border-radius: 999px; padding: 0.15rem 0.6rem; margin: 0.15rem 0.15rem 0.15rem 0; font-size: 0.85rem; }
  section { margin-top: 2rem; }
  code { background: #8883; padding: 0.1rem 0.35rem; border-radius: 4px; }
</style>
</head>
<body>
  <h1>${escapeHtml(profile.company.name ?? "Unknown Company")}</h1>
  <p class="muted">${escapeHtml(profile.meta.domain)} &middot; crawled ${escapeHtml(profile.meta.crawledAt)}</p>
  <p>${escapeHtml(profile.company.description ?? "No description extracted.")}</p>

  ${profile.aiSummary ? `<section><h2>AI summary</h2><p>${escapeHtml(profile.aiSummary.summary)}</p><p><em>${escapeHtml(profile.aiSummary.industryClassification)}</em></p></section>` : ""}

  <section>
    <h2>Company</h2>
    <p><strong>Industry:</strong> ${escapeHtml(profile.company.industry ?? "Unknown")}</p>
    <p><strong>Headquarters:</strong> ${escapeHtml(profile.company.headquarters ?? "Unknown")}</p>
    <p><strong>Social:</strong> ${socialLinksHtml || "None found"}</p>
  </section>

  <section>
    <h2>Technologies detected</h2>
    ${techBadges || "<p>None detected.</p>"}
  </section>

  <section>
    <h2>Contacts</h2>
    <p><strong>Emails:</strong> ${profile.contacts.emails.map(escapeHtml).join(", ") || "None found"}</p>
    <p><strong>Phones:</strong> ${profile.contacts.phones.map(escapeHtml).join(", ") || "None found"}</p>
    <p><strong>Contact forms:</strong> ${profile.contacts.contactForms.length}</p>
  </section>

  ${profile.leadership.length ? `<section><h2>Leadership</h2><ul>${leadershipHtml}</ul></section>` : ""}

  ${
    profile.additionalWebInfo?.length
      ? `<section><h2>Additional web info</h2><ul>${profile.additionalWebInfo
          .map(
            (r) =>
              `<li><a href="${escapeHtml(r.url)}" target="_blank" rel="noopener">${escapeHtml(r.title)}</a><br/><span class="muted">${escapeHtml(r.snippet)}</span></li>`,
          )
          .join("\n")}</ul></section>`
      : ""
  }

  <section>
    <h2>Crawl report</h2>
    <p>${profile.crawlReport.pagesSucceeded}/${profile.crawlReport.pagesAttempted} pages succeeded in ${profile.crawlReport.durationMs}ms, ${profile.crawlReport.totalRetries} retries.</p>
  </section>

  <section>
    <h2>Pages crawled</h2>
    <div class="grid">
      ${screenshotCards || "<p>No screenshots captured.</p>"}
    </div>
  </section>
</body>
</html>`;

  await writeFile(dashboardPath, html, "utf-8");
  return dashboardPath;
}
