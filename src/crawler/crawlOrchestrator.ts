import pLimit from "p-limit";
import type { Response } from "playwright";
import type { Logger } from "pino";
import { BrowserManager } from "../browser/browserManager.js";
import { gotoWithRetry } from "../browser/navigator.js";
import { captureScreenshots } from "../screenshot/screenshotService.js";
import { DEFAULT_CONFIG } from "../config.js";
import { discoverLinks } from "./linkDiscovery.js";
import { planCrawl } from "./crawlPlanner.js";
import type { PageSnapshot } from "../types.js";

export interface CrawlOptions {
  maxPages: number;
  concurrency: number;
  headless: boolean;
  mobileScreenshots: boolean;
  outputDir: string;
}

export interface CrawlResult {
  snapshots: PageSnapshot[];
  errors: { url: string; message: string }[];
  totalRetries: number;
}

async function snapshotPage(
  manager: BrowserManager,
  url: string,
  category: string,
  outputDir: string,
  mobileScreenshots: boolean,
  logger: Logger,
): Promise<PageSnapshot> {
  const page = await manager.newPage();
  const start = Date.now();
  const headers: Record<string, string> = {};

  page.on("response", (res: Response) => {
    if (res.request().isNavigationRequest()) {
      for (const [k, v] of Object.entries(res.headers())) headers[k] = v;
    }
  });

  try {
    const { response, retries } = await gotoWithRetry(page, url);
    const status = response?.status() ?? null;
    const ok = !!response && response.ok();
    const html = await page.content();
    const title = await page.title().catch(() => null);
    const cookies = await manager.cookies();
    const screenshots = await captureScreenshots(page, category, outputDir, mobileScreenshots);

    logger.info({ url, status, retries, timingMs: Date.now() - start }, "page visited");

    return {
      url,
      category,
      title,
      html,
      headers,
      cookies,
      status,
      ok,
      error: ok ? null : `Non-OK response status: ${status}`,
      timingMs: Date.now() - start,
      retries,
      screenshots,
    };
  } catch (err) {
    const message = (err as Error).message;
    logger.warn({ url, err: message }, "page visit failed");
    return {
      url,
      category,
      title: null,
      html: "",
      headers,
      cookies: [],
      status: null,
      ok: false,
      error: message,
      timingMs: Date.now() - start,
      retries: DEFAULT_CONFIG.maxRetries,
      screenshots: { desktop: null, mobile: null },
    };
  } finally {
    await page.close().catch(() => undefined);
  }
}

/**
 * Depth-1 crawl: visits the homepage, discovers + plans priority pages from its rendered HTML, then visits
 * the planned set concurrently (shared browser context) with per-page retry and screenshotting.
 */
export async function crawlSite(homepageUrl: string, opts: CrawlOptions, logger: Logger): Promise<CrawlResult> {
  const manager = new BrowserManager();
  await manager.launch(opts.headless);

  const snapshots: PageSnapshot[] = [];
  const errors: { url: string; message: string }[] = [];
  let totalRetries = 0;

  try {
    const homepage = await snapshotPage(manager, homepageUrl, "home", opts.outputDir, opts.mobileScreenshots, logger);
    snapshots.push(homepage);
    totalRetries += homepage.retries;
    if (!homepage.ok) errors.push({ url: homepageUrl, message: homepage.error ?? "unknown error" });

    let planned: ReturnType<typeof planCrawl> = [];
    if (homepage.html) {
      const links = discoverLinks(homepage.html, homepageUrl);
      planned = planCrawl(homepageUrl, links, opts.maxPages);
      logger.info({ count: planned.length, categories: planned.map((p) => p.category) }, "crawl plan built");
    }

    const limit = pLimit(opts.concurrency);
    const results = await Promise.all(
      planned.map((p) =>
        limit(() => snapshotPage(manager, p.url, p.category, opts.outputDir, opts.mobileScreenshots, logger)),
      ),
    );

    for (const snap of results) {
      snapshots.push(snap);
      totalRetries += snap.retries;
      if (!snap.ok) errors.push({ url: snap.url, message: snap.error ?? "unknown error" });
    }
  } finally {
    await manager.close();
  }

  return { snapshots, errors, totalRetries };
}
