import { describe, it, expect } from "vitest";
import { buildRopa, renderRopaMarkdown, type RopaInputs } from "../src/lib/ropa.js";

function inputs(overrides: Partial<RopaInputs> = {}): RopaInputs {
  return {
    generatedAt: new Date("2026-06-14T08:00:00Z"),
    controller: { name: "Procura", contact: "privacy@procura.hu", dpo: "none" },
    categories: [
      { id: "cleaning", name: "Takarítás" },
      { id: "it-support", name: "IT üzemeltetés / support" },
    ],
    regionCount: 20,
    sources: [
      { id: "overpass", license: "ODbL" },
      { id: "vies", license: "EU VIES (European Commission)" },
    ],
    personalDataRetentionDays: 365,
    outreachEnabled: false,
    ...overrides,
  };
}

describe("buildRopa", () => {
  it("reflects config + taxonomy inputs in the record", () => {
    const r = buildRopa(inputs());
    expect(r.generatedAt).toBe("2026-06-14T08:00:00.000Z");
    expect(r.businessCoverage.regionCount).toBe(20);
    expect(r.businessCoverage.categories).toEqual([
      "Takarítás (cleaning)",
      "IT üzemeltetés / support (it-support)",
    ]);
    expect(r.sources).toEqual([
      { id: "overpass", license: "ODbL" },
      { id: "vies", license: "EU VIES (European Commission)" },
    ]);
  });

  it("carries the retention window and outreach flag through", () => {
    const r = buildRopa(inputs({ personalDataRetentionDays: 180, outreachEnabled: false }));
    expect(r.retention.some((s) => s.includes("180 days"))).toBe(true);
    expect(r.recipients.some((s) => s.includes("OUTREACH_ENABLED=false"))).toBe(true);
  });

  it("states no special-category data and no international transfers", () => {
    const r = buildRopa(inputs());
    expect(r.specialCategories).toMatch(/None/i);
    expect(r.internationalTransfers).toMatch(/None/i);
  });
});

describe("renderRopaMarkdown", () => {
  it("renders all Art. 30 sections as Markdown headings", () => {
    const md = renderRopaMarkdown(buildRopa(inputs()));
    for (const heading of [
      "# Record of Processing Activities (GDPR Art. 30)",
      "## Controller",
      "## Purposes of processing",
      "## Lawful basis",
      "## Categories of data subjects",
      "## Categories of personal data",
      "## Sources",
      "## Recipients",
      "## Retention",
      "## Data-subject rights (how exercised)",
    ]) {
      expect(md).toContain(heading);
    }
    expect(md).toContain("overpass — licence: ODbL");
  });
});
