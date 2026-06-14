import { describe, it, expect } from "vitest";
import { areaSelector } from "../src/connectors/overpass.js";
import { REGIONS } from "../src/taxonomy.js";

describe("areaSelector", () => {
  it("maps every taxonomy region to an Overpass area selector", () => {
    for (const r of REGIONS) {
      expect(() => areaSelector(r.id)).not.toThrow();
      expect(areaSelector(r.id)).toContain('["admin_level"="6"]');
    }
  });
  it("uses the city boundary for Budapest", () => {
    expect(areaSelector("budapest")).toBe('area["name"="Budapest"]["admin_level"="6"]');
  });
  it("builds the '<county> vármegye' name for counties", () => {
    expect(areaSelector("baranya")).toBe('area["name"="Baranya vármegye"]["admin_level"="6"]');
  });
  it("does not double the suffix when the taxonomy name already has it", () => {
    expect(areaSelector("pest")).toBe('area["name"="Pest vármegye"]["admin_level"="6"]');
  });
  it("throws for an unknown region", () => {
    expect(() => areaSelector("atlantis")).toThrow();
  });
});
