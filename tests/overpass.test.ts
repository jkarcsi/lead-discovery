import { describe, it, expect } from "vitest";
import { areaSelector, parseOverpass } from "../src/connectors/overpass.js";
import { REGIONS } from "../src/taxonomy.js";

describe("areaSelector", () => {
  it("resolves an Overpass area for every taxonomy region (Procura parity)", () => {
    // Guards against a region being added to the taxonomy without live coverage.
    for (const r of REGIONS) {
      const sel = areaSelector(r.id);
      expect(sel).toMatch(/^area\["name"=".+"\]\["admin_level"="6"\]$/);
    }
  });

  it("uses the bare city name for Budapest", () => {
    expect(areaSelector("budapest")).toBe('area["name"="Budapest"]["admin_level"="6"]');
  });

  it("appends the vármegye suffix for bare county names", () => {
    expect(areaSelector("hajdu-bihar")).toBe(
      'area["name"="Hajdú-Bihar vármegye"]["admin_level"="6"]',
    );
  });

  it("does not double the suffix when the taxonomy name already carries it", () => {
    // Pest's taxonomy name is "Pest vármegye" — must not become "… vármegye vármegye".
    expect(areaSelector("pest")).toBe('area["name"="Pest vármegye"]["admin_level"="6"]');
  });

  it("throws for an unknown region", () => {
    expect(() => areaSelector("atlantis")).toThrow(/no overpass area mapping/i);
  });
});

describe("parseOverpass", () => {
  it("maps OSM tags to RawBusiness leads with ODbL provenance", () => {
    const raw = parseOverpass(
      {
        elements: [
          {
            type: "node",
            id: 42,
            tags: {
              name: "Teszt Takarító Kft.",
              shop: "cleaning",
              "contact:email": "info@teszt.hu",
              "addr:postcode": "1054",
              "addr:city": "Budapest",
              "ref:vatin": "HU12345678",
            },
          },
        ],
      },
      "budapest",
    );
    expect(raw).toHaveLength(1);
    expect(raw[0]).toMatchObject({
      legalName: "Teszt Takarító Kft.",
      email: "info@teszt.hu",
      vatNumber: "12345678", // HU prefix stripped
      source: "overpass",
      sourceLicense: "ODbL",
      sourceUrl: "https://www.openstreetmap.org/node/42",
    });
  });

  it("skips anonymous POIs without a name", () => {
    const raw = parseOverpass({ elements: [{ type: "node", id: 1, tags: { shop: "kiosk" } }] }, "budapest");
    expect(raw).toEqual([]);
  });
});
