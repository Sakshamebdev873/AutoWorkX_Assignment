# Website Intelligence Engine — Low-Level Design (LLD) & Architecture Diagrams

This document provides complete visual diagrams (in Mermaid.js syntax) and architectural design documentation for the **Website Intelligence Engine**.

---

## 1. High-Level System Architecture & Pipeline Flow

The engine operates as a multi-stage, decoupled data pipeline. Browser automation is isolated to the ingestion stage, producing pure `PageSnapshot` objects that are consumed by the functional extraction layer.

```mermaid
flowchart TD
    CLI["CLI Entrypoint (cli.ts)"] --> ORCH["Orchestrator (index.ts)"]
    
    subgraph CRAWL_STAGE ["Stage 1: Ingestion & Crawl Layer"]
        ORCH --> BM["BrowserManager (Playwright Shared Context)"]
        BM --> NAV["Navigator (gotoWithRetry + p-retry + humanize)"]
        NAV --> LD["Link Discovery (cheerio static parser)"]
        LD --> CP["Crawl Planner (Priority Keyword & URL-Path Scoring)"]
        CP --> CO["Crawl Orchestrator (p-limit Concurrency Bounded)"]
    end
    
    CO --> SNAP["PageSnapshot Array (HTML, Headers, Cookies, Screenshots)"]
    
    subgraph EXTRACT_STAGE ["Stage 2: Pure Functional Extraction Layer (Cheerio & Regex)"]
        SNAP --> EX_INFO["Company Info & JSON-LD Extractor"]
        SNAP --> EX_CONT["Contacts Extractor (Emails, Phones, Forms)"]
        SNAP --> EX_SOC["Social Links Extractor"]
        SNAP --> EX_TECH["Tech Detect (HTML, Header, Cookie Fingerprints)"]
        SNAP --> EX_BRAND["Branding Extractor (Logo, Favicon)"]
        SNAP --> EX_LEAD["Leadership Extractor (Team Page Heuristics)"]
    end
    
    subgraph BONUS_STAGE ["Stage 3: Optional Enrichment Layer"]
        SNAP -.-> AI["AI Summarizer (Claude / OpenAI API)"]
        EX_INFO -.-> WEB["DuckDuckGo Public Web Search"]
    end
    
    EX_INFO & EX_CONT & EX_SOC & EX_TECH & EX_BRAND & EX_LEAD & AI & WEB --> ZOD["Contract Validation (CompanyProfileSchema - Zod)"]
    ZOD --> OUT["Output Artifacts (result.json, dashboard.html, crawl.log)"]
```

---

## 2. Concurrency & Browser Lifecycle Sequence Diagram

This sequence diagram illustrates how the `CrawlOrchestrator` manages browser sessions, executes the homepage crawl, builds the depth-1 crawl plan, and visits subpages concurrently using `p-limit`.

```mermaid
sequenceDiagram
    autonumber
    actor CLI as "CLI / User"
    participant Orch as "Orchestrator (index.ts)"
    participant CO as "CrawlOrchestrator"
    participant BM as "BrowserManager"
    participant Nav as "Navigator (p-retry)"
    participant Plan as "LinkDiscovery & CrawlPlanner"
    participant Limit as "p-limit Concurrency Pool"

    CLI->>Orch: "runEngine({ url: 'https://stripe.com', concurrency: 3 })"
    Orch->>CO: "crawlSite('https://stripe.com', opts)"
    CO->>BM: "launch(headless: true) -> chromium.launch()"
    BM->>BM: "newContext({ userAgent, viewport: 1440x900 })"
    
    Note over CO,Nav: Step 1: Homepage Ingestion & Link Discovery
    CO->>BM: "newPage()"
    BM-->>CO: "page (Shared Context)"
    CO->>Nav: "gotoWithRetry(page, 'https://stripe.com')"
    Nav->>Nav: "p-retry exponential backoff + domcontentloaded"
    Nav->>Nav: "humanize(page) -> random delay + smooth scroll pass"
    Nav-->>CO: "{ response, retries }"
    CO->>CO: "captureScreenshots(desktop & mobile)"
    CO-->>Plan: "discoverLinks(homepage.html) + planCrawl(links)"
    Plan->>Plan: "Filter same-origin, score priority keywords, dedupe 1 per category"
    Plan-->>CO: "PlannedPage[] (e.g., About, Contact, Products, Team)"

    Note over CO,Limit: Step 2: Concurrent Depth-1 Subpage Crawl
    loop "For each PlannedPage in plan (Bounded by p-limit = 3)"
        CO->>Limit: "limit(() => snapshotPage(manager, plannedUrl, category))"
        Limit->>BM: "newPage()"
        BM-->>Limit: "subPage (Shared Context - Cookies Persist)"
        Limit->>Nav: "gotoWithRetry(subPage, plannedUrl)"
        Nav->>Nav: "humanize(subPage)"
        Limit->>Limit: "Extract HTML, Headers, Cookies, Screenshots"
        Limit->>BM: "subPage.close()"
    end

    CO->>BM: "close() -> close context & browser"
    CO-->>Orch: "{ snapshots: PageSnapshot[], errors, totalRetries }"
```

---

## 3. Crawl Planning & Priority Scoring Decision Tree

The `CrawlPlanner` guarantees high precision by filtering out false positives (e.g., customer stories mentioning "product" or blog permalinks mentioning "team") before scoring candidate links against priority categories.

```mermaid
flowchart TD
    Start["Discovered Anchor Link (href + text)"] --> CheckProtocol{"Is HTTP or HTTPS?"}
    CheckProtocol -- No --> Discard["Discard Link"]
    CheckProtocol -- Yes --> CheckOrigin{"Is Same-Origin as Homepage?"}
    CheckOrigin -- No --> Discard
    CheckOrigin -- Yes --> CheckExt{"Is Non-HTML Asset? (.pdf, .zip, .png)"}
    CheckExt -- Yes --> Discard
    CheckExt -- No --> CheckDate{"Is Dated Blog/Changelog Slug? (/2026-06-04-slug)"}
    CheckDate -- Yes --> Discard
    CheckDate -- No --> CheckSeen{"Is URL Already Seen?"}
    CheckSeen -- Yes --> Discard
    CheckSeen -- No --> BuildHaystack["Build Haystack: urlPath + (navText if length <= 30 chars)"]
    
    BuildHaystack --> MatchRule{"Matches Priority Keywords? (About, Contact, Products, etc.)"}
    MatchRule -- No --> Discard
    MatchRule -- Yes --> AssignWeight["Assign Category & Priority Weight (10 to 4)"]
    
    AssignWeight --> GroupCat["Group Candidates by Category"]
    GroupCat --> Dedupe["Retain Highest-Scoring Single Page Per Category"]
    Dedupe --> Cap["Cap Total Pages to --max-pages (Default: 8)"]
    Cap --> Output["Final Depth-1 Crawl Plan"]
```

---

## 4. Pure Functional Extraction Layer Details

Once snapshots (`PageSnapshot[]`) are collected, the extraction layer operates completely in-memory without browser dependencies, enabling fast and deterministic unit testing.

```mermaid
flowchart LR
    subgraph INPUT ["Input Snapshots"]
        SNAP_ARR["PageSnapshot[] (HTML Strings, Headers, Cookies)"]
    end

    subgraph EXTRACTORS ["Pure Extractors (cheerio / regex / set matching)"]
        E1["companyInfo.ts: Schema.org JSON-LD + meta tags + h1/h2/address"]
        E2["contacts.ts: Email regex + Phone regex (>=10 digits) + Contact Form parsing"]
        E3["socialLinks.ts: LinkedIn, Twitter/X, Facebook, Instagram, GitHub, YouTube"]
        E4["techDetect.ts: Match HTML/Header/Cookie strings against ~45 signatures"]
        E5["branding.ts: og:image, rel=icon, apple-touch-icon"]
        E6["leadership.ts: Name/Title heuristic pairing on Team/About pages"]
    end

    subgraph OUTPUT ["Structured Output"]
        PROFILE["Validated CompanyProfile Object"]
    end

    SNAP_ARR --> E1 & E2 & E3 & E4 & E5 & E6
    E1 & E2 & E3 & E4 & E5 & E6 --> PROFILE
```

---

## 5. Engine Pipeline State Diagram

This state diagram shows every major state the engine transitions through during a run, including error recovery paths and optional bonus stages.

```mermaid
stateDiagram-v2
    [*] --> Idle

    Idle --> ParseCLIArgs : User runs CLI command
    ParseCLIArgs --> ResolveURL : Args valid
    ParseCLIArgs --> [*] : Invalid args / --help

    ResolveURL --> InitOutputDir : URL parsed & domain extracted
    InitOutputDir --> LaunchBrowser : mkdir output/domain/

    state BrowserCrawl {
        LaunchBrowser --> HomepageNavigation : chromium.launch() + newContext()

        state HomepageNavigation {
            [*] --> Navigating
            Navigating --> RetryWithBackoff : Navigation timeout / error
            RetryWithBackoff --> Navigating : Retry attempt (max 2)
            RetryWithBackoff --> PageFailed : All retries exhausted
            Navigating --> HumanizePass : domcontentloaded fired
            HumanizePass --> HomepageLoaded : Random delay + scroll + mouse move
            PageFailed --> HomepageLoaded : Return stub snapshot (ok=false)
        }

        HomepageLoaded --> DiscoverLinks : Parse a[href] from rendered HTML (cheerio)
        DiscoverLinks --> PlanCrawl : Filter same-origin, score keywords

        state PlanCrawl {
            [*] --> FilterLinks
            FilterLinks --> ScoreLinks : Remove non-HTTP, cross-origin, assets, dated slugs
            ScoreLinks --> DedupeByCategory : Match against PRIORITY_PAGES keywords
            DedupeByCategory --> CapPages : Keep highest-scoring 1 per category
            CapPages --> PlanReady : Limit to --max-pages
        }

        PlanReady --> ConcurrentSubpageCrawl : PlannedPage[] built

        state ConcurrentSubpageCrawl {
            [*] --> WaitingInPool
            WaitingInPool --> VisitingPage : p-limit slot available
            VisitingPage --> PageRetry : Navigation failure
            PageRetry --> VisitingPage : Retry attempt
            PageRetry --> PageErrored : All retries exhausted
            VisitingPage --> CapturingSnapshot : domcontentloaded + humanize done
            CapturingSnapshot --> ScreenshottingPage : Capture HTML, headers, cookies
            ScreenshottingPage --> PageComplete : desktop + optional mobile screenshot
            PageErrored --> PageComplete : Return stub snapshot (ok=false)
            PageComplete --> WaitingInPool : More pages remaining
            PageComplete --> AllPagesVisited : Last page done
        }

        AllPagesVisited --> CloseBrowser : context.close() + browser.close()
    }

    CloseBrowser --> Extraction : PageSnapshot[] collected

    state Extraction {
        [*] --> RunExtractors
        RunExtractors --> ExtractCompanyInfo
        RunExtractors --> ExtractContacts
        RunExtractors --> ExtractSocialLinks
        RunExtractors --> DetectTechnologies
        RunExtractors --> ExtractBranding
        RunExtractors --> ExtractLeadership
        ExtractCompanyInfo --> ExtractorsDone
        ExtractContacts --> ExtractorsDone
        ExtractSocialLinks --> ExtractorsDone
        DetectTechnologies --> ExtractorsDone
        ExtractBranding --> ExtractorsDone
        ExtractLeadership --> ExtractorsDone
    }

    ExtractorsDone --> CheckLLMFlag

    state BonusEnrichment {
        CheckLLMFlag --> AISummarization : --llm flag set & API key present
        CheckLLMFlag --> CheckWebSearchFlag : --llm not set or no key
        AISummarization --> AISuccess : Claude/OpenAI returns summary
        AISummarization --> AIFailed : API error / timeout
        AIFailed --> CheckWebSearchFlag : aiSummary = null (graceful degradation)
        AISuccess --> CheckWebSearchFlag

        CheckWebSearchFlag --> WebSearch : --web-search flag set
        CheckWebSearchFlag --> BonusDone : --web-search not set
        WebSearch --> WebSearchSuccess : DuckDuckGo results parsed
        WebSearch --> WebSearchFailed : Scrape failed / rate limited
        WebSearchFailed --> BonusDone : additionalWebInfo = null
        WebSearchSuccess --> BonusDone
    }

    BonusDone --> ZodValidation : Assemble CompanyProfile object
    ZodValidation --> WriteOutputs : CompanyProfileSchema.parse() passes
    ZodValidation --> ValidationError : Schema mismatch (should not happen)

    state WriteOutputs {
        [*] --> WriteJSON
        WriteJSON --> RenderDashboard : result.json written
        RenderDashboard --> OutputComplete : dashboard.html rendered
    }

    OutputComplete --> [*] : Run complete, return CompanyProfile
    ValidationError --> [*] : Throw error
```

---

## 6. Per-Page Navigation State Diagram

This shows the lifecycle of a single page visit inside `snapshotPage()`, including retry logic, human-like simulation, and failure capture.

```mermaid
stateDiagram-v2
    [*] --> OpenNewTab : manager.newPage() from shared context

    OpenNewTab --> AttachHeaderListener : page.on('response') for navigation requests

    state NavigationWithRetry {
        AttachHeaderListener --> AttemptNavigation : page.goto(url, domcontentloaded)
        AttemptNavigation --> WaitForDOM : HTTP response received
        AttemptNavigation --> NavigationTimeout : Timeout after 20s
        NavigationTimeout --> BackoffDelay : retries++ (p-retry exponential)
        BackoffDelay --> AttemptNavigation : min 500ms delay, retry
        BackoffDelay --> NavigationFailed : retries > maxRetries (2)
    }

    WaitForDOM --> HumanSimulation : DOM content loaded

    state HumanSimulation {
        [*] --> RandomDelay : 250ms to 900ms pause
        RandomDelay --> MouseMove : page.mouse.move(random x, random y)
        MouseMove --> GradualScroll : scrollTo in 250px steps with 50ms pauses
        GradualScroll --> ScrollToTop : Scroll back to (0, 0)
        ScrollToTop --> [*]
    }

    HumanSimulation --> CapturePageData

    state CapturePageData {
        [*] --> GetHTML : page.content()
        GetHTML --> GetTitle : page.title()
        GetTitle --> GetCookies : manager.cookies()
        GetCookies --> TakeDesktopScreenshot : Full-page screenshot
        TakeDesktopScreenshot --> CheckMobileFlag
        CheckMobileFlag --> TakeMobileScreenshot : --mobile flag set
        CheckMobileFlag --> DataCaptured : No mobile flag
        TakeMobileScreenshot --> DataCaptured
    }

    DataCaptured --> BuildSnapshot : Assemble PageSnapshot object

    state BuildSnapshot {
        [*] --> SetFields
        SetFields --> SuccessSnapshot : ok=true, html, headers, cookies, screenshots
    }

    NavigationFailed --> BuildErrorSnapshot

    state BuildErrorSnapshot {
        [*] --> SetErrorFields
        SetErrorFields --> ErrorSnapshot : ok=false, error=message, html='', screenshots=null
    }

    SuccessSnapshot --> CloseTab : page.close()
    ErrorSnapshot --> CloseTab : page.close()
    CloseTab --> [*] : Return PageSnapshot
```

---

## 7. Architectural Choices, Reasons, & Tradeoffs

| Component / Layer | Design Choice | Reason / Motivation | Trade-off / Limitation |
| :--- | :--- | :--- | :--- |
| **Extraction Architecture** | **Decoupled DOM Extraction (`PageSnapshot[] -> Data` via Cheerio)** | • **Testability:** Extraction functions can be unit tested against static HTML fixtures in milliseconds (`npm test`) without browser execution.<br>• **Performance:** Cheerio string parsing is 10x–50x faster than Playwright IPC DOM queries.<br>• **Stability:** Isolates data extraction from browser crash risks. | Cannot execute client-side JavaScript *during* extraction (requires the `humanize` scroll and `domcontentloaded` wait to populate the DOM prior to taking the snapshot). |
| **Link Discovery & Planning** | **Heuristic Keyword & URL-Path Scoring vs. LLM Link Selection** | • **Precision & Speed:** Executes in `<5ms` deterministically.<br>• **Bug Prevention:** Restricting link text checking to $\le 30$ chars and excluding dated permalinks prevents blog articles mentioning "product" or "team" from overriding real landing pages (`/products`). | Custom or non-standard URL structures (e.g., `/what-we-build` without standard keywords) require dictionary additions in `src/config.ts`. |
| **Deduplication Strategy** | **One Page Per Priority Category** | • **Bounded Execution:** Prevents crawling 15 variations of `/blog/post-1...15` or 5 identical `/contact-sales` pages, keeping runs fast ($\le 8$ pages total). | May miss secondary pages inside the same category if a company splits content across two URLs (e.g., `/software` and `/hardware`). |
| **Browser Session Management** | **Shared `BrowserContext` (`BrowserManager`) across Concurrent Visits** | • **Session Persistence:** Cookies, consent banners, and WAF tokens obtained on the homepage persist when visiting subpages.<br>• **Resource Efficiency:** Avoids heavy memory/CPU overhead of launching separate browser processes per tab. | Shared cookies mean pages share browser state; one page modifying local storage could affect another (negligible risk for read-only crawling). |
| **Technology Fingerprinting** | **Curated Fingerprint Dictionary (`TECH_SIGNATURES`) vs. Wappalyzer** | • **Zero Dependency Footprint:** Eliminates heavy npm packages and licensing overhead.<br>• **Traceability:** Every detection (e.g., Cloudflare via `__cf_bm` cookie or `cf-ray` header) is exact, transparent, and easy to debug. | Covers ~45 top enterprise technologies instead of Wappalyzer's 3,000+ long-tail plugins; requires manual additions for new tech. |
| **Optional Web Search** | **DuckDuckGo No-JS Scrape (`--web-search`) vs. Paid Search API** | • **Zero Setup Required:** Allows users to test web search enrichment immediately without purchasing API keys (Bing/Serp/Brave). | **Fragility:** Scraping public HTML (`html.duckduckgo.com`) can break if DuckDuckGo changes its DOM layout or applies rate limits. |
| **Error Handling & Resilience** | **Graceful Bonus & Page-Level Degradation** | • **Pipeline Resilience:** If an LLM API key fails, leadership parsing misses, or a page returns `403 Forbidden` (e.g., Cloudflare bot challenge), the engine catches the error, logs a warning, and completes the JSON report with whatever succeeded. | Output fields may degrade to `null` or `[]` rather than halting early to force manual intervention. |
