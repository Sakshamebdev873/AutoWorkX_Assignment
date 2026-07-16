import type { PageSnapshot } from "../../src/types.js";

export function fakeSnapshot(overrides: Partial<PageSnapshot> & { html: string }): PageSnapshot {
  return {
    url: "https://example.com/",
    category: "home",
    title: "Example",
    headers: {},
    cookies: [],
    status: 200,
    ok: true,
    error: null,
    timingMs: 100,
    retries: 0,
    screenshots: { desktop: null, mobile: null },
    ...overrides,
  };
}
