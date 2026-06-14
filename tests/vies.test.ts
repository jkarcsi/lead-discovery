import { describe, it, expect } from "vitest";
import { huVatCore, parseViesResult, viesRequestBody } from "../src/lib/vies.js";

describe("huVatCore", () => {
  it("reduces HU-prefixed / suffixed numbers to the 8-digit core", () => {
    expect(huVatCore("HU10773381")).toBe("10773381");
    expect(huVatCore("10773381-2-41")).toBe("10773381");
    expect(huVatCore("  107 733 81 ")).toBe("10773381");
  });
  it("returns null when it can't form 8 digits", () => {
    expect(huVatCore("123")).toBeNull();
    expect(huVatCore(null)).toBeNull();
  });
});

describe("viesRequestBody", () => {
  it("uppercases the country and keeps digits only", () => {
    expect(viesRequestBody("hu", "HU10773381")).toEqual({
      countryCode: "HU",
      vatNumber: "10773381",
    });
  });
});

describe("parseViesResult", () => {
  it("parses a valid response with trader details", () => {
    expect(
      parseViesResult({
        valid: true,
        name: "Tiszta Iroda Kft.",
        address: "1051 Budapest, Fő utca 1.",
        requestDate: "2026-06-14+02:00",
      }),
    ).toEqual({
      valid: true,
      name: "Tiszta Iroda Kft.",
      address: "1051 Budapest, Fő utca 1.",
      requestDate: "2026-06-14+02:00",
    });
  });
  it("treats withheld fields ('---', empty) as null", () => {
    expect(parseViesResult({ valid: true, name: "---", address: "  " })).toEqual({
      valid: true,
      name: null,
      address: null,
      requestDate: null,
    });
  });
  it("reports an invalid number and tolerates garbage", () => {
    expect(parseViesResult({ valid: false }).valid).toBe(false);
    expect(parseViesResult(null).valid).toBe(false);
    expect(parseViesResult(undefined).valid).toBe(false);
  });
});
