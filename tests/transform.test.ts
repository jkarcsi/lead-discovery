import { describe, it, expect } from "vitest";
import { transform } from "../src/pipeline/transform.js";
import { parseOverpass } from "../src/connectors/overpass.js";
import { qualityScore } from "../src/lib/quality.js";
import budapest from "../src/connectors/fixtures/overpass-budapest.json" assert { type: "json" };
import type { RawBusiness } from "../src/types.js";

describe("transform", () => {
  it("normalizes, categorizes, and detects region", () => {
    const raw: RawBusiness = {
      legalName: "KlímaProfi Bt.",
      classificationText: "Klíma telepítés és karbantartás",
      phone: "06 30 111 2233",
      website: "www.klimaprofi.hu",
      address: "1132 Budapest, Váci út 44",
      source: "overpass",
      sourceLicense: "ODbL",
    };
    const lead = transform(raw);
    expect(lead.phone).toBe("+36301112233");
    expect(lead.domain).toBe("klimaprofi.hu");
    expect(lead.regionId).toBe("budapest");
    expect(lead.categories).toContain("hvac");
    expect(lead.isPersonalData).toBe(false);
  });

  it("flags sole traders and named-person mailboxes as personal data", () => {
    const ev = transform({
      legalName: "Nagy Péter e.v.",
      email: "nagy.peter@gmail.com",
      classificationText: "tűzvédelem",
      source: "overpass",
    });
    expect(ev.isPersonalData).toBe(true);
  });

  it("treats general inboxes as non-personal", () => {
    const lead = transform({
      legalName: "Tiszta Iroda Kft.",
      email: "info@tisztairoda.hu",
      source: "overpass",
    });
    expect(lead.isPersonalData).toBe(false);
  });
});

describe("parseOverpass + quality", () => {
  it("parses the fixture into raw businesses with provenance", () => {
    const records = parseOverpass(budapest as any, "budapest");
    expect(records.length).toBeGreaterThan(5);
    expect(records.every((r) => r.sourceLicense === "ODbL")).toBe(true);
    expect(records.every((r) => r.sourceUrl?.includes("openstreetmap.org"))).toBe(true);
  });

  it("scores a complete lead higher than a bare one", () => {
    const full = transform({
      legalName: "ITSzerviz Megoldások Kft.",
      email: "support@itszerviz.hu",
      website: "https://itszerviz.hu",
      classificationText: "IT üzemeltetés rendszergazda",
      address: "1117 Budapest",
      vatNumber: "10773381",
      source: "overpass",
    });
    const bare = transform({ legalName: "Belváros Pékség", source: "overpass" });
    expect(qualityScore(full)).toBeGreaterThan(qualityScore(bare));
  });
});
