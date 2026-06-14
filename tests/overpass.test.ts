import { describe, it, expect } from "vitest";
import { buildQuery } from "../src/connectors/overpass.js";
import { REGIONS } from "../src/taxonomy.js";

describe("overpass area coverage", () => {
  it("builds a query for every Procura region (all 20)", () => {
    expect(REGIONS.length).toBe(20);
    for (const r of REGIONS) {
      expect(() => buildQuery(r.id, 50)).not.toThrow();
    }
  });

  it("targets the capital for Budapest and a vármegye relation for counties", () => {
    expect(buildQuery("budapest", 10)).toContain('area["name"="Budapest"]');
    expect(buildQuery("hajdu-bihar", 10)).toContain('area["name"="Hajdú-Bihar vármegye"]');
    // Pest's taxonomy name already carries the suffix — no double "vármegye".
    expect(buildQuery("pest", 10)).toContain('area["name"="Pest vármegye"]');
    expect(buildQuery("pest", 10)).not.toContain("vármegye vármegye");
  });

  it("honors the limit and selects business POI tags", () => {
    const q = buildQuery("zala", 75);
    expect(q).toContain('admin_level"="6"');
    expect(q).toMatch(/nwr\["office"\]/);
    expect(q).toMatch(/out center tags 75;/);
  });

  it("rejects an unknown region", () => {
    expect(() => buildQuery("atlantis", 10)).toThrow(/no overpass area mapping/i);
  });
});
