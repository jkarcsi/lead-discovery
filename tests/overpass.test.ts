import { describe, it, expect } from "vitest";
import { areaSelector, parseOverpass } from "../src/connectors/overpass.js";
import { REGIONS } from "../src/taxonomy.js";

describe("areaSelector", () => {
  it("maps Budapest and counties to admin_level 6 boundaries", () => {
    expect(areaSelector("budapest")).toBe('area["name"="Budapest"]["admin_level"="6"]');
    expect(areaSelector("bacs-kiskun")).toBe(
      'area["name"="Bács-Kiskun vármegye"]["admin_level"="6"]',
    );
    // Pest's taxonomy name already carries the vármegye suffix — not doubled.
    expect(areaSelector("pest")).toBe('area["name"="Pest vármegye"]["admin_level"="6"]');
  });
  it("covers every taxonomy region (countrywide --live)", () => {
    for (const r of REGIONS) {
      expect(() => areaSelector(r.id)).not.toThrow();
    }
  });
  it("rejects an unknown region", () => {
    expect(() => areaSelector("atlantis")).toThrow();
  });
});

describe("parseOverpass", () => {
  it("extracts named businesses and skips anonymous POIs", () => {
    const out = parseOverpass(
      {
        elements: [
          {
            type: "node",
            id: 1,
            tags: {
              name: "Tiszta Iroda Kft.",
              office: "company",
              "contact:email": "info@tisztairoda.hu",
              "addr:city": "Budapest",
              "ref:vatin": "HU10773381",
            },
          },
          { type: "node", id: 2, tags: { shop: "convenience" } }, // no name → dropped
        ],
      },
      "budapest",
    );
    expect(out).toHaveLength(1);
    expect(out[0].legalName).toBe("Tiszta Iroda Kft.");
    expect(out[0].email).toBe("info@tisztairoda.hu");
    expect(out[0].vatNumber).toBe("10773381");
    expect(out[0].source).toBe("overpass");
    expect(out[0].sourceLicense).toBe("ODbL");
  });
});
