import { describe, expect, it } from "vitest";
import { detectTechnologies } from "../../src/extract/techDetect.js";
import { fakeSnapshot } from "../helpers/snapshot.js";

describe("detectTechnologies", () => {
  it("matches known signatures in HTML and headers", () => {
    const html = `<html><head><script src="https://www.googletagmanager.com/gtm.js"></script></head>
      <body class="wp-content"><script src="/wp-includes/js/jquery/jquery.min.js"></script></body></html>`;
    const snap = fakeSnapshot({ html, headers: { server: "cloudflare" } });
    const tech = detectTechnologies([snap]).map((t) => t.name);
    expect(tech).toContain("Google Tag Manager");
    expect(tech).toContain("WordPress");
    expect(tech).toContain("jQuery");
    expect(tech).toContain("Cloudflare");
  });
});
