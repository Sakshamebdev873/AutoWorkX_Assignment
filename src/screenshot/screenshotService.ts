import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { Page } from "playwright";
import { DEFAULT_CONFIG } from "../config.js";

function safeFileName(category: string): string {
  return category.replace(/[^a-z0-9-]/gi, "_");
}

export interface CapturedScreenshots {
  desktop: string | null;
  mobile: string | null;
}

/** Captures a full-page desktop screenshot always, plus a mobile one when requested — each failure is isolated. */
export async function captureScreenshots(
  page: Page,
  category: string,
  outputDir: string,
  includeMobile: boolean,
): Promise<CapturedScreenshots> {
  const dir = path.join(outputDir, "screenshots");
  await mkdir(dir, { recursive: true });
  const name = safeFileName(category);
  const result: CapturedScreenshots = { desktop: null, mobile: null };

  try {
    await page.setViewportSize(DEFAULT_CONFIG.desktopViewport);
    const desktopPath = path.join(dir, `${name}-desktop.png`);
    await page.screenshot({ path: desktopPath, fullPage: true, timeout: 15_000 });
    result.desktop = desktopPath;
  } catch {
    // e.g. extremely tall/animated page timing out — don't fail the whole page snapshot over a screenshot
  }

  if (includeMobile) {
    try {
      await page.setViewportSize(DEFAULT_CONFIG.mobileViewport);
      const mobilePath = path.join(dir, `${name}-mobile.png`);
      await page.screenshot({ path: mobilePath, fullPage: true, timeout: 15_000 });
      result.mobile = mobilePath;
      await page.setViewportSize(DEFAULT_CONFIG.desktopViewport);
    } catch {
      // best-effort
    }
  }

  return result;
}
