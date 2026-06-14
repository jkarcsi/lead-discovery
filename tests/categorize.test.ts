import { describe, it, expect } from "vitest";
import { categorize, detectRegion } from "../src/lib/categorize.js";

describe("categorize", () => {
  it("maps activity text to Procura category ids", () => {
    expect(categorize("Irodatakarítás és higiéniai szolgáltatás")).toContain("cleaning");
    expect(categorize("Klíma telepítés, hűtés-fűtés")).toContain("hvac");
    expect(categorize("őrzés-védelem, portaszolgálat")).toContain("security");
    expect(categorize("tűzjelző rendszerek karbantartása")).toContain("fire-safety");
    expect(categorize("rendszergazda és hálózat support")).toContain("it-support");
    expect(categorize("munkavédelem és kockázatértékelés")).toContain("occupational-safety");
  });
  it("matches accent-insensitively", () => {
    expect(categorize("KLIMA SZERELES")).toContain("hvac");
  });
  it("returns empty for unrelated text", () => {
    expect(categorize("pékség, friss kenyér")).toEqual([]);
    expect(categorize("")).toEqual([]);
  });
  it("can return multiple categories", () => {
    const cats = categorize("takarítás és őrzés-védelem");
    expect(cats).toContain("cleaning");
    expect(cats).toContain("security");
  });
});

describe("detectRegion", () => {
  it("uses 1xxx postcodes for Budapest", () => {
    expect(detectRegion("1054 Budapest, Báthory utca 10")).toBe("budapest");
  });
  it("prefers Budapest over a generic Pest mention", () => {
    expect(detectRegion("Budapest, Pest")).toBe("budapest");
  });
  it("detects county seats", () => {
    expect(detectRegion("2100 Gödöllő, Dózsa György út")).toBe("pest");
    expect(detectRegion("Debrecen")).toBe("hajdu-bihar");
  });
  it("returns null when nothing matches", () => {
    expect(detectRegion("Wien, Austria")).toBeNull();
    expect(detectRegion(null)).toBeNull();
  });
});
