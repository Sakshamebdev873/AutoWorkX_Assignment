import { describe, expect, it } from "vitest";
import { extractSocialLinks } from "../../src/extract/socialLinks.js";
import { fakeSnapshot } from "../helpers/snapshot.js";

describe("extractSocialLinks", () => {
  it("finds known platform profile links and ignores share/login links", () => {
    const html = `
      <html><body>
        <a href="https://www.linkedin.com/company/acme">LinkedIn</a>
        <a href="https://twitter.com/acme">Twitter</a>
        <a href="https://www.facebook.com/sharer/sharer.php?u=https://acme.com">Share</a>
      </body></html>`;
    const links = extractSocialLinks([fakeSnapshot({ html, url: "https://acme.com/" })]);
    expect(links.linkedin).toBe("https://www.linkedin.com/company/acme");
    expect(links.twitter).toBe("https://twitter.com/acme");
    expect(links.facebook).toBeNull();
  });
});
