# Website Intelligence Engine

A CLI tool that crawls a company website (depth 1) and produces a structured "company intelligence"
JSON report — company info, contacts, social links, detected technologies, screenshots, and more —
built with Playwright + TypeScript.

Built for the AutoWorkx Software Development Internship assignment (Browser Automation & Website
Intelligence Engine).

## Quick start

```bash
npm install          # also downloads a Chromium build via Playwright (postinstall)
npm run crawl -- --url https://stripe.com
```

Output lands in `output/<domain>/`:

```
output/stripe.com/
  result.json        structured company intelligence (see schema below)
  dashboard.html      self-contained visual report — open directly in a browser
  crawl.log            structured logs (pino, JSON lines)
  screenshots/
    home-desktop.png
    home-mobile.png    (only with --mobile)
    about-desktop.png
    ...
```

## CLI usage

```bash
npm run crawl -- --url <url> [options]

  -u, --url <url>          company website URL to analyze (required)
  --max-pages <n>          max depth-1 pages to crawl beyond the homepage (default: 8)
  --concurrency <n>        concurrent page visits (default: 3)
  --headless <bool>        run browser headless (default: true)
  --mobile                 also capture mobile-viewport screenshots
  --llm                    enable AI summarization/classification (needs ANTHROPIC_API_KEY or OPENAI_API_KEY)
  --web-search              look up additional public info about the company via web search
  -o, --output <dir>       output directory (default: "output")
```

Example with every bonus flag on:

```bash
npm run crawl -- --url https://linear.app --mobile --llm --web-search --concurrency 4
```

For `--llm`, copy `.env.example` to `.env` and set `ANTHROPIC_API_KEY` and/or `OPENAI_API_KEY`. If both
are set, Anthropic (Claude) is used; otherwise it falls back to OpenAI (ChatGPT). Without either key,
`--llm` is a no-op (logs a notice and continues) — it never blocks the rest of the run.

## Running tests

```bash
npm test
```

15+ unit tests cover the extraction/planning logic (emails, social links, tech fingerprinting,
company info, crawl prioritization, web-search parsing) against fixture HTML — no browser or network
required. See [Testing approach](#testing-approach) below for why extraction logic is structured to be
testable this way.

## Architecture overview

```
src/
  cli.ts                    entrypoint — arg parsing, kicks off a run
  index.ts                  pipeline orchestration for a single run
  config.ts                 priority-page keywords, timeouts, concurrency defaults
  types.ts                  Zod schema for the output + internal types

  browser/
    browserManager.ts       owns one Playwright browser + one shared context (session reuse)
    navigator.ts             goto with retry/backoff (p-retry) + human-like scroll/delay pass

  crawler/
    linkDiscovery.ts         pulls <a href> out of already-rendered HTML (cheerio, no live page)
    crawlPlanner.ts           scores links against priority keywords, same-origin only, depth-1 plan
    crawlOrchestrator.ts     visits the plan concurrently (p-limit), screenshots + captures each page

  extract/                  pure functions: PageSnapshot[] -> structured data (cheerio-based, unit tested)
    companyInfo.ts            name / description / industry / HQ / locations / products / services
    contacts.ts                emails / phones / contact forms / department contacts
    socialLinks.ts             LinkedIn / X / Facebook / Instagram / GitHub / YouTube
    techDetect.ts               curated fingerprint matcher (CMS, analytics, CDN, etc.)
    branding.ts                 logo / favicon
    leadership.ts                heuristic name+title pairing on Team/About pages
    jsonLd.ts                    shared schema.org Organization JSON-LD parser

  screenshot/screenshotService.ts   full-page desktop (+ optional mobile) capture
  search/webSearch.ts               optional DuckDuckGo lookup for extra public company info
  ai/summarizer.ts                  optional Claude/ChatGPT summarization/classification
  report/
    logger.ts                  pino logger (pretty console + crawl.log file)
    dashboard.ts                 renders the static HTML report

tests/                     fixture-based unit tests, mirroring src/ layout
```

### Pipeline

1. **Fetch homepage** with retry + human-like scroll/delay (`browser/navigator.ts`).
2. **Discover links** from the rendered homepage HTML (`crawler/linkDiscovery.ts`).
3. **Plan the depth-1 crawl**: same-origin only, scored against priority keywords (About, Contact,
   Products, Services, Careers, Pricing, Team, Blog, Support, Resources), one page kept per category,
   capped to `--max-pages` (`crawler/crawlPlanner.ts`).
4. **Visit the plan concurrently** (shared browser context, `p-limit`-bounded), capturing HTML,
   response headers, cookies, and screenshots per page, with per-page retry on failure
   (`crawler/crawlOrchestrator.ts`).
5. **Extract** company info, contacts, social links, tech stack, branding, and leadership from the
   aggregated page snapshots — all pure, cheerio-based functions with no browser dependency, which is
   what makes them fast to unit test.
6. **Optional bonus stages**: Claude/ChatGPT summarization/classification (`--llm`), public web search
   (`--web-search`).
7. **Assemble + validate** the final `CompanyProfile` against a Zod schema, write `result.json`, and
   render `dashboard.html`.

### Design decisions

- **Custom tech fingerprint list** (`data/techSignatures.ts`, ~45 signatures) instead of a third-party
  Wappalyzer dependency — smaller footprint, no license concerns, and every match is traceable to a
  specific `htmlPatterns`/`headerPatterns` entry.
- **Extraction is decoupled from the browser.** Every `extract/*` module takes `PageSnapshot[]` (plain
  HTML strings + metadata) and returns data — no `Page` object involved. That's what let the test suite
  cover real extraction logic against saved HTML fixtures instead of mocking a browser.
- **One page per category.** The crawl planner keeps only the highest-scoring URL per priority
  category rather than crawling every matching link, which keeps runs fast and output focused.
- **Every bonus stage degrades to `null`/`[]` on failure** (LLM, web search, leadership, screenshots)
  — a broken bonus feature never takes down the core JSON output.
- **Static, self-contained dashboard.** No server, no build step — just embeds screenshots via relative
  paths so `dashboard.html` can be opened straight from the output folder.

## What's implemented

**Core requirements** — all 7 from the assignment brief: browser automation (Playwright, JS-rendered
sites), intelligent depth-1 crawling with page prioritization, screenshots (full-page, desktop *and*
mobile), information extraction (name/description/industry/products/services/technologies/HQ/
locations/contacts/logo/favicon), contact discovery (emails/phones/forms/department contacts), social
media discovery (6 platforms), and clean Zod-validated JSON output.

**Bonus features implemented**: leadership discovery, LinkedIn profile detection, intelligent crawl
prioritization, human-like automation (scroll/delay/session reuse), parallel page visits, retry with
backoff, structured logging + crawl reports, HTML dashboard, optional Claude LLM summarization, and
optional public web search.

**Not implemented**: nothing from the bonus list was skipped — see [Known limitations](#known-limitations)
for accuracy caveats on the heuristic-based bonus features (leadership discovery, industry
classification) rather than missing functionality.

## Assumptions

- "Depth 1" means the homepage plus its directly-linked pages — the crawler does not follow links
  found on those depth-1 pages.
- Priority-page matching is keyword/URL-based, not a language model — it favors precision (correctly
  labeling the real About/Contact/etc. page) over recall (finding every possible relevant page), based
  on the two mis-categorization bugs found and fixed during testing (see below).
- One page is kept per priority category. A site with, say, three different "Products" links will only
  have the single best-scoring one crawled.
- The tool identifies as a normal desktop Chrome browser (custom user agent) and makes a best-effort
  attempt to behave human-like, but does **not** attempt to bypass bot-detection/CAPTCHA systems —
  sites that actively block automated traffic (see the WP Tavern case below) will fail gracefully
  rather than being circumvented.

## Known limitations

- **Industry/HQ extraction is heuristic-only.** Without a schema.org `Organization` JSON-LD block or an
  explicit `<address>` tag, both are `null` rather than guessed from prose.
- **Phone number extraction is regex-based** and tuned to avoid the worst false positives (a copyright
  year glued to a price, for instance) by requiring 10+ digits — this trades away some short local
  numbers for fewer garbage matches.
- **Leadership discovery is layout-dependent.** It pairs a name-shaped heading with a nearby title-shaped
  string in the same container; sites that render team cards via heavier client-side JS the crawler
  doesn't wait long enough for, or use unusual markup, won't produce matches.
- **Web search relies on scraping DuckDuckGo's no-JS HTML endpoint** (no official API/key). It's
  wrapped in try/catch and degrades to an empty list on failure, but is inherently fragile if
  DuckDuckGo changes their markup.
- **Sites with bot protection** (Cloudflare challenge pages, WAFs that 403 on datacenter IPs, etc.)
  will show up as failed pages in `crawlReport.errors` rather than being bypassed — verified live
  against wptavern.com, which returned HTTP 403 to every request; the tool logged it and produced a
  valid (empty-page) `result.json` rather than crashing.

## Future improvements

- Depth-2 crawling behind a flag, for sites where the useful content is one level deeper.
- A proper industry taxonomy/classifier instead of the current keyword dictionary (or always route
  through `--llm` for this field when available).
- Structured department-contact matching for phone numbers, not just emails.
- Swap the DuckDuckGo scrape for a real search API (Bing/Serp/Brave) behind an API key, for reliability.
- Optional Redis-backed caching so re-running against the same domain within a TTL skips re-crawling.

## Testing approach

- **Unit tests** (`npm test`, Vitest) exercise the extraction and planning logic against static HTML
  fixtures — fast, deterministic, no browser or network involved. This is also how two real bugs were
  caught and fixed during development (not staged for the writeup):
  1. Email extraction was concatenating text from adjacent, unrelated DOM elements into bogus compound
     matches (cheerio's `.text()` has no separator between block-level siblings) — fixed by joining
     text nodes with explicit spaces, with a regression test (`contacts.test.ts`).
  2. The crawl planner was scoring pages against full anchor text and any URL substring, so a
     customer-story blurb mentioning "product" got mislabeled as the Products page, and a changelog
     post URL containing the word "team" got mislabeled as the Team page — fixed by preferring URL
     paths, ignoring long non-nav-like link text, and excluding dated blog/changelog permalinks from
     category scoring, with regression tests (`crawlPlanner.test.ts`).
- **Manual end-to-end verification** was run against real, differently-shaped sites: stripe.com
  (marketing/fintech), linear.app (SaaS product site), and wptavern.com (WordPress site that turned out
  to bot-block all requests, useful as a live error-handling test). Also verified against a nonexistent
  domain to confirm retry + graceful failure without a crash.
