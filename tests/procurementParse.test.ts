import { describe, it, expect } from "vitest";
import { parseProcurementPage } from "../src/lib/procurementParse.js";

const ctx = {
  baseUrl: "https://ekr.test/api",
  license: "Közbeszerzési Értesítő (public procurement)",
  source: "kozbeszerzes",
};

describe("parseProcurementPage", () => {
  it("maps a won award to a supplier with CPV-derived categories", () => {
    const out = parseProcurementPage(
      {
        results: [
          {
            id: "KE-1",
            supplierName: "Fővárosi IT Üzemeltető Zrt.",
            supplierVat: "HU12345676",
            supplierAddress: "1075 Budapest, Károly körút 1.",
            cpvCodes: ["72500000-0"],
            title: "Informatikai support",
          },
        ],
      },
      ctx,
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      legalName: "Fővárosi IT Üzemeltető Zrt.",
      vatNumber: "HU12345676",
      categories: ["it-support"],
      source: "kozbeszerzes",
      sourceUrl: "https://ekr.test/api/eljaras/KE-1",
    });
  });

  it("skips awards with no named supplier", () => {
    expect(parseProcurementPage({ results: [{ cpvCodes: ["72500000-0"] }] }, ctx)).toEqual([]);
  });

  it("yields empty categories when CPV is missing/unmapped", () => {
    const out = parseProcurementPage({ results: [{ supplierName: "X Kft." }] }, ctx);
    expect(out[0].categories).toEqual([]);
  });
});
