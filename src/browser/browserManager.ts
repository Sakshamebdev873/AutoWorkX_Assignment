import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { DEFAULT_CONFIG } from "../config.js";

/** Owns a single browser + one shared context (session reuse: cookies/storage persist across page visits). */
export class BrowserManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;

  async launch(headless: boolean): Promise<void> {
    this.browser = await chromium.launch({ headless });
    this.context = await this.browser.newContext({
      userAgent: DEFAULT_CONFIG.userAgent,
      viewport: DEFAULT_CONFIG.desktopViewport,
    });
  }

  async newPage(): Promise<Page> {
    if (!this.context) throw new Error("BrowserManager.launch() must be called before newPage()");
    return this.context.newPage();
  }

  async cookies(): Promise<string[]> {
    if (!this.context) return [];
    const cookies = await this.context.cookies();
    return cookies.map((c) => c.name);
  }

  async close(): Promise<void> {
    await this.context?.close().catch(() => undefined);
    await this.browser?.close().catch(() => undefined);
    this.context = null;
    this.browser = null;
  }
}
