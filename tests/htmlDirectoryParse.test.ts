import { describe, it, expect } from "vitest";
import { parseHtmlDirectory } from "../src/lib/htmlDirectoryParse.js";

const ctx = { baseUrl: "https://list.test", license: "directory (public HTML listing)", source: "htmldir" };

const HTML = `
<ul class="results">
  <li class="biz" data-id="7">
    <h3 class="name">Kovács &amp; Társa Kft.</h3>
    <p class="cat">takarítás, higiénia</p>
    <a class="email" href="mailto:info@kovacs.hu">e-mail</a>
    <span class="phone">+36 1 234 5678</span>
    <a class="web" href="https://kovacs.hu">kovacs.hu</a>
    <span class="addr">1051 Budapest, F&#337; utca 1.</span>
  </li>
  <li class="biz" data-id="8">
    <span class="phone">+36 1 000 0000</span>
  </li>
</ul>`;

describe("parseHtmlDirectory", () => {
  it("extracts a business card with decoded entities and mailto/href fields", () => {
    const out = parseHtmlDirectory(HTML, ctx);
    expect(out).toHaveLength(1); // the nameless card is skipped
    expect(out[0]).toMatchObject({
      legalName: "Kovács & Társa Kft.", // &amp; decoded
      email: "info@kovacs.hu", // taken from the mailto href, not the link text
      phone: "+36 1 234 5678",
      website: "https://kovacs.hu",
      address: "1051 Budapest, Fő utca 1.", // &#337; decoded
      source: "htmldir",
      sourceUrl: "https://list.test/biz/7",
      sourceLicense: "directory (public HTML listing)",
    });
    expect(out[0].classificationText).toContain("takarítás");
  });

  it("returns nothing for HTML with no business cards", () => {
    expect(parseHtmlDirectory("<html><body>nope</body></html>", ctx)).toEqual([]);
    expect(parseHtmlDirectory("", ctx)).toEqual([]);
  });

  it("parses multiple cards in document order", () => {
    const html = `
      <div class="biz" data-id="1"><h3 class="name">A Kft.</h3></div>
      <div class="biz" data-id="2"><h3 class="name">B Kft.</h3></div>`;
    const out = parseHtmlDirectory(html, ctx);
    expect(out.map((r) => r.legalName)).toEqual(["A Kft.", "B Kft."]);
  });
});
