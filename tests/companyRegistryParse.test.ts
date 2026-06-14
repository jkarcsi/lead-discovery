import { describe, it, expect } from "vitest";
import { parseCompanyRegistryPage } from "../src/lib/companyRegistryParse.js";

const ctx = {
  baseUrl: "https://e-beszamolo.test/api",
  license: "Céginformációs Szolgálat (public company data)",
  source: "ebeszamolo",
};

describe("parseCompanyRegistryPage", () => {
  it("maps a company record incl. registration number + TEÁOR, with provenance", () => {
    const out = parseCompanyRegistryPage(
      {
        results: [
          {
            id: "01-09-111111",
            companyName: "Tiszta Iroda Kft.",
            taxNumber: "HU10773381",
            registrationNumber: "01-09-111111",
            seat: "1051 Budapest, Arany János utca 10.",
            teaorText: "Általános épülettakarítás",
          },
        ],
      },
      ctx,
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      legalName: "Tiszta Iroda Kft.",
      vatNumber: "HU10773381",
      registrationNumber: "01-09-111111",
      address: "1051 Budapest, Arany János utca 10.",
      source: "ebeszamolo",
      sourceUrl: "https://e-beszamolo.test/api/cegadat/01-09-111111",
      sourceLicense: "Céginformációs Szolgálat (public company data)",
    });
    expect(out[0].classificationText).toContain("épülettakarítás");
  });

  it("skips records without a company name", () => {
    expect(parseCompanyRegistryPage({ results: [{ taxNumber: "HU123" }] }, ctx)).toEqual([]);
  });

  it("handles missing/empty results", () => {
    expect(parseCompanyRegistryPage({}, ctx)).toEqual([]);
    expect(parseCompanyRegistryPage({ results: [] }, ctx)).toEqual([]);
  });

  it("falls back to the base url when a record has no id", () => {
    const out = parseCompanyRegistryPage({ results: [{ companyName: "NoId Kft." }] }, ctx);
    expect(out[0].sourceUrl).toBe("https://e-beszamolo.test/api");
  });
});
