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
  it("uses the registration number when there is no VAT", () => {
    expect(dedupeKey({ ...base, registrationNumber: "01-09-222222" })).toBe("reg:0109222222");
  });
  it("prefers VAT over registration number", () => {
    expect(
      dedupeKey({ ...base, vatNumber: "10773381", registrationNumber: "01-09-222222" }),
    ).toBe("vat:10773381");
  });
  it("prefers registration number over domain", () => {
    expect(
      dedupeKey({ ...base, registrationNumber: "01-09-222222", domain: "x.hu" }),
    ).toBe("reg:0109222222");
  });
  it("matches the same company number across name spelling variations", () => {
    const a = dedupeKey({ ...base, legalName: "Budai Tűzvédelmi Kft.", registrationNumber: "01-09-222222" });
    const b = dedupeKey({
      ...base,
      legalName: "Budai Tűzvédelmi Mérnökiroda Korlátolt Felelősségű Társaság",
      registrationNumber: "01-09-222222",
    });
    expect(a).toBe(b);
  });
  it("falls back to domain when VAT is missing/invalid and no reg number", () => {
    expect(dedupeKey({ ...base, vatNumber: "12345678", domain: "tisztairoda.hu" })).toBe(
      "domain:tisztairoda.hu",
    );
  });
  it("ignores a malformed registration number", () => {
    expect(dedupeKey({ ...base, registrationNumber: "123", domain: "x.hu" })).toBe("domain:x.hu");
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
    const existing: LeadInput = { ...base, email: "info@tisztairoda.hu", categories: ["cleaning"] };
    const incoming: LeadInput = {
      ...base,
      phone: "+3612345678",
      categories: ["security"],
      isPersonalData: true,
    };
    const merged = mergeLead(existing, incoming);
    expect(merged.email).toBe("info@tisztairoda.hu");
    expect(merged.phone).toBe("+3612345678");
    expect(merged.categories.sort()).toEqual(["cleaning", "security"]);
    expect(merged.isPersonalData).toBe(true); // sticky
  });
});
