import { describe, it, expect } from "vitest";
import { areaSelector, buildQuery } from "../src/connectors/overpass.js";
import { REGIONS } from "../src/taxonomy.js";

describe("areaSelector", () => {
  it("maps Budapest to its admin_level 6 area without a vármegye suffix", () => {
    expect(areaSelector("budapest")).toBe(
      'area["name"="Budapest"]["admin_level"="6"]',
    );
  });

  it("appends 'vármegye' to county names that lack it", () => {
    expect(areaSelector("bacs-kiskun")).toBe(
      'area["name"="Bács-Kiskun vármegye"]["admin_level"="6"]',
    );
    expect(areaSelector("gyor-moson-sopron")).toBe(
      'area["name"="Győr-Moson-Sopron vármegye"]["admin_level"="6"]',
    );
  });

  it("does not double the suffix when the taxonomy name already ends in vármegye", () => {
    expect(areaSelector("pest")).toBe(
      'area["name"="Pest vármegye"]["admin_level"="6"]',
    );
  });

  it("covers every taxonomy region (all 19 counties + Budapest)", () => {
    for (const r of REGIONS) {
      const sel = areaSelector(r.id);
      expect(sel).toMatch(/^area\["name"="[^"]+"\]\["admin_level"="6"\]$/);
      // Every region but Budapest must resolve to a "<X> vármegye" county area.
      if (r.id !== "budapest") expect(sel).toContain("vármegye");
    }
    expect(REGIONS).toHaveLength(20);
  });

  it("rejects unknown regions with a clear message", () => {
    expect(() => areaSelector("atlantis")).toThrow(/no overpass area mapping/i);
  });
});

describe("buildQuery", () => {
  it("embeds the area selector and applies the result limit", () => {
    const q = buildQuery("baranya", 50);
    expect(q).toContain('area["name"="Baranya vármegye"]["admin_level"="6"]->.a;');
    expect(q).toContain('nwr["office"](area.a);');
    expect(q).toContain('nwr["healthcare"](area.a);');
    expect(q.trimEnd().endsWith("out center tags 50;")).toBe(true);
  });
});
