import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import * as cheerio from "cheerio";
import { summarizeCompany } from "./ai/summarizer.js";
import { crawlSite } from "./crawler/crawlOrchestrator.js";
import { extractBranding } from "./extract/branding.js";
import { extractCompanyInfo } from "./extract/companyInfo.js";
import { extractContacts } from "./extract/contacts.js";
import { extractLeadership } from "./extract/leadership.js";
import { extractSocialLinks } from "./extract/socialLinks.js";
import { detectTechnologies } from "./extract/techDetect.js";
import { renderDashboard } from "./report/dashboard.js";
import { createLogger } from "./report/logger.js";
import { searchCompanyInfo } from "./search/webSearch.js";
import { CompanyProfileSchema, type CompanyProfile, type RunOptions } from "./types.js";

const ENGINE_VERSION = "1.0.0";

function bodyText(html: string): string {
  if (!html) return "";
  try {
    return cheerio.load(html)("body").text().replace(/\s+/g, " ").trim();
  } catch {
    return "";
  }
}

export async function runEngine(opts: RunOptions): Promise<CompanyProfile> {
  const resolved = new URL(opts.url);
  const domain = resolved.hostname.replace(/^www\./, "");
  const runOutputDir = path.join(opts.outputDir, domain);
  await mkdir(runOutputDir, { recursive: true });

  const logger = createLogger(runOutputDir);
  const startedAt = new Date();
  logger.info({ url: opts.url }, "starting crawl");

  const { snapshots, errors, totalRetries } = await crawlSite(
    resolved.toString(),
    {
      maxPages: opts.maxPages,
      concurrency: opts.concurrency,
      headless: opts.headless,
      mobileScreenshots: opts.mobileScreenshots,
      outputDir: runOutputDir,
    },
    logger,
  );

  logger.info({ pages: snapshots.length, failed: errors.length }, "crawl finished — extracting");

  const companyInfo = extractCompanyInfo(snapshots);
  const contacts = extractContacts(snapshots);
  const socialLinks = extractSocialLinks(snapshots);
  const technologies = detectTechnologies(snapshots);
  const branding = extractBranding(snapshots);
  const leadership = extractLeadership(snapshots);

  let aiSummary = null;
  if (opts.llm) {
    const textContext = snapshots
      .filter((s) => s.html)
      .map((s) => `# ${s.category} (${s.url})\n${bodyText(s.html)}`)
      .join("\n\n")
      .slice(0, 12_000);
    aiSummary = await summarizeCompany(textContext, logger);
  }

  let additionalWebInfo = null;
  if (opts.webSearch) {
    const query = `${companyInfo.name ?? domain} company`;
    additionalWebInfo = await searchCompanyInfo(query, logger);
  }

  const finishedAt = new Date();

  const profile = CompanyProfileSchema.parse({
    meta: {
      inputUrl: opts.url,
      resolvedUrl: resolved.toString(),
      domain,
      crawledAt: startedAt.toISOString(),
      engineVersion: ENGINE_VERSION,
    },
    company: {
      name: companyInfo.name,
      description: companyInfo.description,
      industry: companyInfo.industry,
      headquarters: companyInfo.headquarters,
      locations: companyInfo.locations,
    },
    products: companyInfo.products,
    services: companyInfo.services,
    technologies,
    branding,
    contacts,
    socialLinks,
    leadership,
    aiSummary,
    additionalWebInfo,
    pagesCrawled: snapshots.map((s) => ({
      url: s.url,
      category: s.category,
      title: s.title,
      status: s.status,
      ok: s.ok,
      error: s.error,
      timingMs: s.timingMs,
      retries: s.retries,
      screenshots: s.screenshots,
    })),
    crawlReport: {
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      pagesAttempted: snapshots.length,
      pagesSucceeded: snapshots.filter((s) => s.ok).length,
      pagesFailed: snapshots.filter((s) => !s.ok).length,
      totalRetries,
      errors,
    },
  });

  const resultPath = path.join(runOutputDir, "result.json");
  await writeFile(resultPath, JSON.stringify(profile, null, 2), "utf-8");
  await renderDashboard(profile, runOutputDir);

  logger.info({ resultPath }, "run complete");
  return profile;
}
