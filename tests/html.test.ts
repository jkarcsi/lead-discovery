import { describe, it, expect } from "vitest";
import { extractCategoryText } from "../src/lib/html.js";
import { categorize } from "../src/lib/categorize.js";

describe("extractCategoryText", () => {
  it("pulls the strongest 'what we do' signal from title/meta/headings", () => {
    const html = `<html><head>
      <title>Lánghír Kft. – tűzvédelmi szaktanácsadás Pécs</title>
      <meta name="description" content="Tűzvédelmi szabályzat és oltókészülék karbantartás.">
      </head><body><h1>Tűzvédelem profiknak</h1><p>egyéb szöveg</p></body></html>`;
    const text = extractCategoryText(html);
    expect(text).toContain("tűzvédelmi");
    expect(text).toContain("oltókészülék"); // from meta description
    // The whole point: a website with no category keyword in its name still
    // categorizes from its page text.
    expect(categorize(text)).toContain("fire-safety");
  });

  it("handles meta with content before name, and og:description", () => {
    const html = `<meta content="ipari takarítás és irodatakarítás" name="keywords">
      <meta property="og:description" content="higiéniai szolgáltatás">`;
    expect(categorize(extractCategoryText(html))).toContain("cleaning");
  });

  it("falls back to body text when the head is sparse", () => {
    const html = `<html><head><title>Kezdőlap</title></head><body>
      <p>Cégünk klímaszerelést és légkondicionáló karbantartást végez.</p></body></html>`;
    expect(categorize(extractCategoryText(html))).toContain("hvac");
  });

  it("bounds the output length", () => {
    const html = "<body>" + "tűzvédelem ".repeat(500) + "</body>";
    expect(extractCategoryText(html, 200).length).toBeLessThanOrEqual(200);
  });

  it("returns empty string for empty input", () => {
    expect(extractCategoryText("")).toBe("");
  });
});
