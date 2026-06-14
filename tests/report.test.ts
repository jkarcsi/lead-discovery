import { describe, it, expect } from "vitest";
import { buildCoverageReport, type ReportLead } from "../src/lib/report.js";

function lead(overrides: Partial<ReportLead> = {}): ReportLead {
  return {
    source: "overpass",
    categories: ["cleaning"],
    qualityScore: 80,
    hasEmail: true,
    isPersonalData: false,
    viesVerified: false,
    navChecked: false,
    contactChecked: false,
    placesChecked: false,
    reviewStatus: "PENDING",
    ...overrides,
  };
}

describe("buildCoverageReport", () => {
  it("aggregates totals, sources, enrichment, quality and review", () => {
    const r = buildCoverageReport([
      lead({ source: "overpass", qualityScore: 90, viesVerified: true, navChecked: true }),
      lead({ source: "directory", qualityScore: 50, reviewStatus: "APPROVED" }),
      lead({ source: "overpass", qualityScore: 20, hasEmail: false, isPersonalData: true, reviewStatus: "REJECTED" }),
    ]);
    expect(r.total).toBe(3);
    expect(r.withEmail).toBe(2);
    expect(r.personalData).toBe(1);
    expect(r.bySource).toEqual([
      ["overpass", 2],
      ["directory", 1],
    ]);
    expect(r.quality).toEqual({ high: 1, medium: 1, low: 1 });
    expect(r.review).toEqual({ pending: 1, approved: 1, rejected: 1 });
    expect(r.enrichment.viesVerified).toBe(1);
    expect(r.enrichment.navChecked).toBe(1);
  });

  it("handles an empty database", () => {
    const r = buildCoverageReport([]);
    expect(r.total).toBe(0);
    expect(r.bySource).toEqual([]);
  });
});
