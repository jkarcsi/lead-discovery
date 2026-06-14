import { describe, it, expect } from "vitest";
import {
  huVatForVies,
  parseViesResponse,
  verificationPatch,
  type ViesResult,
} from "../src/lib/vies.js";

describe("huVatForVies", () => {
  it("returns the 8-digit base for a checksum-valid HU VAT", () => {
    expect(huVatForVies("HU10773381")).toBe("10773381");
    expect(huVatForVies("10773381")).toBe("10773381");
  });

  it("takes the first 8 digits of an 11-digit (group) VAT", () => {
    expect(huVatForVies("10773381-2-41")).toBe("10773381");
  });

  it("rejects a number whose checksum is wrong", () => {
    expect(huVatForVies("10773382")).toBeNull();
  });

  it("rejects empty / malformed input", () => {
    expect(huVatForVies(null)).toBeNull();
    expect(huVatForVies("HU123")).toBeNull();
  });
});

describe("parseViesResponse", () => {
  it("parses a valid response with name + address", () => {
    const r = parseViesResponse({
      valid: true,
      name: "TISZTA IRODA KFT.",
      address: "1051 BUDAPEST,\nARANY JÁNOS UTCA 10.",
      requestDate: "2026-06-14+02:00",
    });
    expect(r.valid).toBe(true);
    expect(r.name).toBe("TISZTA IRODA KFT.");
    expect(r.address).toBe("1051 BUDAPEST, ARANY JÁNOS UTCA 10."); // whitespace collapsed
    expect(r.requestDate).toBe("2026-06-14+02:00");
  });

  it("treats the '---' placeholder and blanks as null", () => {
    const r = parseViesResponse({ valid: false, name: "---", address: "   " });
    expect(r.valid).toBe(false);
    expect(r.name).toBeNull();
    expect(r.address).toBeNull();
  });

  it("is defensive about missing / non-string fields", () => {
    const r = parseViesResponse({});
    expect(r).toEqual({ valid: false, name: null, address: null, requestDate: null });
    expect(parseViesResponse(null).valid).toBe(false);
  });
});

describe("verificationPatch", () => {
  const valid = (address: string | null): ViesResult => ({
    valid: true,
    name: "X",
    address,
    requestDate: null,
  });

  it("fills a missing address from a valid result", () => {
    expect(verificationPatch({ address: null }, valid("1051 Budapest"))).toEqual({
      address: "1051 Budapest",
    });
  });

  it("never overwrites an address the lead already has", () => {
    expect(verificationPatch({ address: "existing" }, valid("1051 Budapest"))).toEqual({});
  });

  it("does not enrich from an invalid result", () => {
    const invalid: ViesResult = { valid: false, name: null, address: "x", requestDate: null };
    expect(verificationPatch({ address: null }, invalid)).toEqual({});
  });

  it("does nothing when VIES returned no address", () => {
    expect(verificationPatch({ address: null }, valid(null))).toEqual({});
  });
});
