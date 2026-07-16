import pRetry from "p-retry";
import type { Page, Response } from "playwright";
import { DEFAULT_CONFIG } from "../config.js";

export interface NavigateResult {
  response: Response | null;
  retries: number;
}

function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const ms = minMs + Math.random() * (maxMs - minMs);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Small human-like pause + scroll pass, best-effort — a failure here should never fail the crawl. */
export async function humanize(page: Page): Promise<void> {
  await randomDelay(DEFAULT_CONFIG.humanDelay.minMs, DEFAULT_CONFIG.humanDelay.maxMs);
  try {
    await page.mouse.move(100 + Math.random() * 200, 100 + Math.random() * 200);
    await page.evaluate(async () => {
      const distance = Math.min(document.body.scrollHeight, 2000);
      const step = 250;
      for (let y = 0; y < distance; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 50));
      }
      window.scrollTo(0, 0);
    });
  } catch {
    // ignore — page may navigate away or lack a body during teardown
  }
}

/** Navigates with retry + exponential backoff (via p-retry), then applies a human-like scroll/delay pass. */
export async function gotoWithRetry(
  page: Page,
  url: string,
  opts: { timeoutMs?: number; maxRetries?: number } = {},
): Promise<NavigateResult> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_CONFIG.navigationTimeoutMs;
  const maxRetries = opts.maxRetries ?? DEFAULT_CONFIG.maxRetries;
  let retries = 0;

  const response = await pRetry(
    () => page.goto(url, { timeout: timeoutMs, waitUntil: "domcontentloaded" }),
    {
      retries: maxRetries,
      minTimeout: DEFAULT_CONFIG.retryMinTimeoutMs,
      onFailedAttempt: () => {
        retries += 1;
      },
    },
  );

  await humanize(page);
  return { response, retries };
}
