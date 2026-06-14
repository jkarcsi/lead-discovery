import { describe, it, expect } from "vitest";
import { toProcuraRecord, type ExportLeadRow } from "../src/lib/procuraExport.js";

const row: ExportLeadRow = {
  id: "lead_1",
  legalName: "Tiszta Iroda Kft.",
  vatNumber: "10773381",
  registrationNumber: "01-09-111111",
  regionId: "budapest",
  categories: '["cleaning"]',
  email: "info@tisztairoda.hu",
  phone: null,
  website: "https://tisztairoda.hu",
  qualityScore: 90,
  taxStatus: "ACTIVE",
  debtFree: true,
  source: "overpass",
};

describe("toProcuraRecord", () => {
  it("maps a lead row to the Procura export shape with parsed categories", () => {
    expect(toProcuraRecord(row)).toEqual({
      externalId: "lead_1",
      legalName: "Tiszta Iroda Kft.",
      vatNumber: "10773381",
      registrationNumber: "01-09-111111",
      regionId: "budapest",
      categories: ["cleaning"],
      email: "info@tisztairoda.hu",
      phone: null,
      website: "https://tisztairoda.hu",
      qualityScore: 90,
      taxStatus: "ACTIVE",
      debtFree: true,
      source: "overpass",
    });
  });

  it("is JSON-serializable (NDJSON line)", () => {
    const line = JSON.stringify(toProcuraRecord(row));
    expect(JSON.parse(line).externalId).toBe("lead_1");
  });
});
