import { describe, expect, it } from "vitest";
import { parseSearchResults } from "../../src/search/webSearch.js";

describe("parseSearchResults", () => {
  it("extracts title/url/snippet from DuckDuckGo's HTML result markup", () => {
    const html = `
      <html><body>
        <div class="result">
          <a class="result__a" href="https://en.wikipedia.org/wiki/Acme_Corp">Acme Corp - Wikipedia</a>
          <a class="result__snippet">Acme Corp is a fictional company known for its products.</a>
        </div>
        <div class="result">
          <a class="result__a" href="https://news.example.com/acme-raises-funding">Acme raises Series B</a>
          <a class="result__snippet">Acme announced a new funding round today.</a>
        </div>
      </body></html>`;
    const results = parseSearchResults(html);
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({
      title: "Acme Corp - Wikipedia",
      url: "https://en.wikipedia.org/wiki/Acme_Corp",
      snippet: "Acme Corp is a fictional company known for its products.",
    });
  });

  it("unwraps DuckDuckGo's click-tracking redirect to the real destination URL", () => {
    const html = `
      <html><body>
        <div class="result">
          <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Facme.com%2Fabout&rut=abc123">About - Acme</a>
          <a class="result__snippet">Acme's about page.</a>
        </div>
      </body></html>`;
    const results = parseSearchResults(html);
    expect(results[0]?.url).toBe("https://acme.com/about");
  });

  it("respects the result limit", () => {
    const oneResult = `<div class="result"><a class="result__a" href="https://a.com">A</a><a class="result__snippet">snip</a></div>`;
    const html = `<html><body>${oneResult.repeat(10)}</body></html>`;
    expect(parseSearchResults(html, 3)).toHaveLength(3);
  });

  it("returns an empty array for unrecognized markup rather than throwing", () => {
    expect(parseSearchResults("<html><body>no results here</body></html>")).toEqual([]);
  });
});
