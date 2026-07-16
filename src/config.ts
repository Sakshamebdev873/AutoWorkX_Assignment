export interface PriorityPageRule {
  category: string;
  keywords: string[];
  weight: number;
}

/** Depth-1 crawl targets, scored by matching URL path segments and link text against these keyword sets. */
export const PRIORITY_PAGES: PriorityPageRule[] = [
  { category: "about", keywords: ["about", "about-us", "who-we-are", "company", "our-story"], weight: 10 },
  { category: "contact", keywords: ["contact", "contact-us", "get-in-touch", "reach-us"], weight: 10 },
  { category: "products", keywords: ["product", "products"], weight: 8 },
  { category: "services", keywords: ["service", "services", "solutions"], weight: 8 },
  { category: "pricing", keywords: ["pricing", "plans", "plan"], weight: 7 },
  { category: "team", keywords: ["team", "leadership", "people", "our-team", "management"], weight: 7 },
  { category: "careers", keywords: ["career", "careers", "jobs", "join-us", "join-our-team"], weight: 6 },
  { category: "blog", keywords: ["blog", "news", "insights", "press"], weight: 5 },
  { category: "support", keywords: ["support", "help", "faq", "helpdesk"], weight: 5 },
  { category: "resources", keywords: ["resources", "docs", "documentation"], weight: 4 },
];

export const DEFAULT_CONFIG = {
  maxDepth1Pages: 8,
  concurrency: 3,
  navigationTimeoutMs: 20_000,
  maxRetries: 2,
  retryMinTimeoutMs: 500,
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 WebsiteIntelligenceEngine/1.0",
  desktopViewport: { width: 1440, height: 900 },
  mobileViewport: { width: 390, height: 844 },
  outputDir: "output",
  humanDelay: {
    minMs: 250,
    maxMs: 900,
  },
};

export type EngineConfig = typeof DEFAULT_CONFIG;
