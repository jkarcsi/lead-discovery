import { describe, it, expect } from "vitest";
import { dedupeKey, mergeLead } from "../src/lib/dedupe.js";
import type { LeadInput } from "../src/types.js";

const base: LeadInput = {
  legalName: "Tiszta Iroda Kft.",
  brandName: null,
  email: null,
  phone: null,
  website: null,
  domain: null,
  address: null,
  vatNumber: null,
  registrationNumber: null,
  regionId: "budapest",
  categories: [],
  source: "overpass",
  sourceUrl: null,
  sourceLicense: "ODbL",
  isPersonalData: false,
};

describe("dedupeKey", () => {
  it("prefers a valid VAT number", () => {
    expect(dedupeKey({ ...base, vatNumber: "10773381" })).toBe("vat:10773381");
  });
  it("falls back to domain when VAT is missing/invalid", () => {
    expect(dedupeKey({ ...base, vatNumber: "12345678", domain: "tisztairoda.hu" })).toBe(
      "domain:tisztairoda.hu",
    );
  });
  it("falls back to normalized name + region", () => {
    expect(dedupeKey(base)).toBe("name:tiszta iroda|budapest");
  });
  it("does not alias different identity kinds", () => {
    expect(dedupeKey({ ...base, vatNumber: "10773381" })).not.toBe(
      dedupeKey({ ...base, domain: "tisztairoda.hu" }),
    );
  });
});

describe("mergeLead", () => {
  it("fills gaps from the incoming record and unions categories", () => {
    const existing: LeadInput = { ...base, email: "info@tisztairoda.hu", categories: ["takaritas"] };
    const incoming: LeadInput = {
      ...base,
      phone: "+3612345678",
      categories: ["orzes-vedelem"],
      isPersonalData: true,
    };
    const merged = mergeLead(existing, incoming);
    expect(merged.email).toBe("info@tisztairoda.hu");
    expect(merged.phone).toBe("+3612345678");
    expect(merged.categories.sort()).toEqual(["orzes-vedelem", "takaritas"]);
    expect(merged.isPersonalData).toBe(true); // sticky
  });
});
