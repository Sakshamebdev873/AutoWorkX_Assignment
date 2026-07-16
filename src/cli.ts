#!/usr/bin/env node
import "dotenv/config";
import { Command } from "commander";
import { DEFAULT_CONFIG } from "./config.js";
import { runEngine } from "./index.js";

const program = new Command();

program
  .name("wie")
  .description("Website Intelligence Engine — crawl a company site and produce structured intelligence.")
  .requiredOption("-u, --url <url>", "company website URL to analyze")
  .option("--max-pages <n>", "max depth-1 pages to crawl (beyond the homepage)", String(DEFAULT_CONFIG.maxDepth1Pages))
  .option("--concurrency <n>", "concurrent page visits", String(DEFAULT_CONFIG.concurrency))
  .option("--headless <bool>", "run browser headless", "true")
  .option("--mobile", "also capture mobile-viewport screenshots", false)
  .option("--llm", "enable Claude-based summarization/classification (requires ANTHROPIC_API_KEY)", false)
  .option("--web-search", "look up additional public info about the company via web search", false)
  .option("-o, --output <dir>", "output directory", DEFAULT_CONFIG.outputDir)
  .parse(process.argv);

const opts = program.opts<{
  url: string;
  maxPages: string;
  concurrency: string;
  headless: string;
  mobile: boolean;
  llm: boolean;
  webSearch: boolean;
  output: string;
}>();

const normalizedUrl = /^https?:\/\//i.test(opts.url) ? opts.url : `https://${opts.url}`;

runEngine({
  url: normalizedUrl,
  maxPages: Number(opts.maxPages),
  concurrency: Number(opts.concurrency),
  headless: opts.headless !== "false",
  mobileScreenshots: Boolean(opts.mobile),
  llm: Boolean(opts.llm),
  webSearch: Boolean(opts.webSearch),
  outputDir: opts.output,
})
  .then((profile) => {
    console.log(`\nDone. ${profile.crawlReport.pagesSucceeded}/${profile.crawlReport.pagesAttempted} pages captured.`);
    console.log(`Output: ${opts.output}/${profile.meta.domain}/result.json`);
    console.log(`Dashboard: ${opts.output}/${profile.meta.domain}/dashboard.html`);
  })
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exitCode = 1;
  });
