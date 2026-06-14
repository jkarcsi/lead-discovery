import { describe, it, expect } from "vitest";
import { parseDirectoryPage } from "../src/lib/directoryParse.js";

const ctx = { baseUrl: "https://dir.test/api", license: "directory (public listing)", source: "directory" };

describe("parseDirectoryPage", () => {
  it("maps records to RawBusiness with source + provenance", () => {
    const out = parseDirectoryPage(
      {
        results: [
          {
            id: 42,
            name: "Acme Kft.",
            email: "info@acme.hu",
            phone: "+36 1 234 5678",
            website: "https://acme.hu",
            address: "1051 Budapest",
            vat: "HU10773381",
            activity: "takarítás",
          },
        ],
      },
      ctx,
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      legalName: "Acme Kft.",
      email: "info@acme.hu",
      vatNumber: "HU10773381",
      source: "directory",
      sourceUrl: "https://dir.test/api/biz/42",
      sourceLicense: "directory (public listing)",
    });
    expect(out[0].classificationText).toContain("takarítás");
    expect(out[0].classificationText).toContain("Acme Kft.");
  });

  it("skips records without a name", () => {
    const out = parseDirectoryPage({ results: [{ name: "  " }, { email: "x@y.hu" }] }, ctx);
    expect(out).toEqual([]);
  });

  it("handles a missing/empty results array", () => {
    expect(parseDirectoryPage({}, ctx)).toEqual([]);
    expect(parseDirectoryPage({ results: [] }, ctx)).toEqual([]);
  });

  it("falls back to the base url when a record has no id", () => {
    const out = parseDirectoryPage({ results: [{ name: "NoId Kft." }] }, ctx);
    expect(out[0].sourceUrl).toBe("https://dir.test/api");
  });
});
