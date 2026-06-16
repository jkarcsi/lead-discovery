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

  // Regression: the "it"/"support" keywords used to substring-match unrelated
  // words, mis-filing pharmacies, bakeries and bike shops as IT. Short/generic
  // tokens must match only as whole words.
  it("does not mis-file -it words or 'support' compounds as IT", () => {
    expect(categorize("pharmacy Margit Gyógyszertár")).not.toContain("it-support");
    expect(categorize("Favorit Pékség Mintabolt")).not.toContain("it-support");
    expect(categorize("West Fit Shop")).not.toContain("it-support");
    expect(categorize("Fit-Boys kerékpárüzlet és szerviz")).not.toContain("it-support");
    expect(categorize("Egészségügyi Szolgáltató Nonprofit Zrt.")).not.toContain("it-support");
    expect(categorize("Bikesupport;Kerékpár szerviz")).not.toContain("it-support");
  });

  it("still recognizes genuine IT via whole-word 'it', stems and compounds", () => {
    expect(categorize("Fővárosi IT Üzemeltető Zrt.")).toContain("it-support");
    expect(categorize("IT-support szolgáltatás")).toContain("it-support");
    expect(categorize("Unicomp Informatikai Kft.")).toContain("it-support");
    expect(categorize("PC-Valkó Számítógép Szaküzlet")).toContain("it-support");
    // Hungarian compounds still match the substring stems.
    expect(categorize("klímaszerviz és fűtésszerelés")).toContain("hvac");
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
