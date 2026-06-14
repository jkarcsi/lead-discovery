import { describe, it, expect } from "vitest";
import { qualityScore } from "../src/lib/quality.js";
import type { LeadInput } from "../src/types.js";

const base: LeadInput = {
  legalName: "Tiszta Iroda Kft.",
  email: "info@tisztairoda.hu",
  phone: "+3612345678",
  website: "tisztairoda.hu",
  domain: "tisztairoda.hu",
  address: "1051 Budapest, Fő utca 1.",
  vatNumber: "10773381", // valid check digit
  regionId: "budapest",
  categories: ["cleaning"],
  source: "overpass",
  isPersonalData: false,
};

describe("qualityScore", () => {
  it("rewards completeness and a checksum-valid VAT", () => {
    // 30+10+10+10+10+15 + 15 (checksum) = 100
    expect(qualityScore(base)).toBe(100);
  });

  it("treats an externally-confirmed VAT as the strongest signal", () => {
    const lean = { ...base, phone: null, website: null, domain: null };
    // 30+10+10+15 = 65 base; +20 verified vs +15 checksum-only.
    expect(qualityScore(lean, true)).toBe(qualityScore(lean) + 5);
  });

  it("withholds VAT credit when verification fails", () => {
    const lean = { ...base, phone: null, website: null, domain: null };
    // checksum would give +15; a confirmed-invalid VAT gives 0.
    expect(qualityScore(lean, false)).toBe(qualityScore(lean) - 15);
  });
});
