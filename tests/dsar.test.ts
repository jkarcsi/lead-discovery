import { describe, it, expect } from "vitest";
import { buildDsarReport, type DsarLeadInput } from "../src/lib/dsar.js";

const NOW = new Date("2026-06-14T08:00:00Z");

function lead(overrides: Partial<DsarLeadInput> = {}): DsarLeadInput {
  return {
    legalName: "Nagy Péter e.v.",
    brandName: null,
    email: "nagy.peter@example.hu",
    phone: "+36301234567",
    website: null,
    domain: null,
    address: "1051 Budapest",
    vatNumber: null,
    registrationNumber: null,
    regionId: "budapest",
    categories: JSON.stringify(["fire-safety"]),
    isPersonalData: true,
    gdprBasis: "legitimate_interest",
    qualityScore: 75,
    lifecycle: "NEW",
    source: "overpass",
    sourceUrl: "https://www.openstreetmap.org/node/1",
    sourceLicense: "ODbL",
    collectedAt: new Date("2026-06-10T10:00:00Z"),
    lastVerifiedAt: null,
    auditEvents: [],
    ...overrides,
  };
}

describe("buildDsarReport", () => {
  it("reports an empty holding for a subject we have no data on", () => {
    const r = buildDsarReport("nobody@example.hu", [], NOW);
    expect(r).toEqual({
      subject: "nobody@example.hu",
      generatedAt: "2026-06-14T08:00:00.000Z",
      leadCount: 0,
      records: [],
    });
  });

  it("serializes a lead with provenance, parsed categories, and ISO dates", () => {
    const r = buildDsarReport("nagy.peter@example.hu", [lead()], NOW);
    expect(r.leadCount).toBe(1);
    const rec = r.records[0];
    expect(rec.categories).toEqual(["fire-safety"]); // JSON column parsed
    expect(rec.collectedAt).toBe("2026-06-10T10:00:00.000Z");
    expect(rec.lastVerifiedAt).toBeNull();
    expect(rec.source).toBe("overpass");
    expect(rec.sourceLicense).toBe("ODbL");
    expect(rec.isPersonalData).toBe(true);
    expect(rec.auditTrail).toEqual([]);
  });

  it("includes the full audit trail with serialized timestamps", () => {
    const r = buildDsarReport(
      "nagy.peter@example.hu",
      [
        lead({
          auditEvents: [
            { type: "COLLECTED", meta: '{"source":"overpass"}', createdAt: new Date("2026-06-10T10:00:00Z") },
            { type: "VERIFIED", meta: null, createdAt: new Date("2026-06-12T09:30:00Z") },
          ],
        }),
      ],
      NOW,
    );
    expect(r.records[0].auditTrail).toEqual([
      { type: "COLLECTED", meta: '{"source":"overpass"}', createdAt: "2026-06-10T10:00:00.000Z" },
      { type: "VERIFIED", meta: null, createdAt: "2026-06-12T09:30:00.000Z" },
    ]);
  });

  it("serializes lastVerifiedAt when present", () => {
    const r = buildDsarReport(
      "x@example.hu",
      [lead({ lastVerifiedAt: new Date("2026-06-13T00:00:00Z") })],
      NOW,
    );
    expect(r.records[0].lastVerifiedAt).toBe("2026-06-13T00:00:00.000Z");
  });
});
