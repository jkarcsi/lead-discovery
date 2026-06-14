import { describe, it, expect } from "vitest";
import {
  normalizeEmail,
  normalizePhone,
  domainFromUrl,
  normalizeCompanyName,
  isValidHuVat,
} from "../src/lib/normalize.js";

describe("normalizeEmail", () => {
  it("lowercases and trims valid emails", () => {
    expect(normalizeEmail("  Info@Example.HU ")).toBe("info@example.hu");
  });
  it("rejects garbage", () => {
    expect(normalizeEmail("not-an-email")).toBeNull();
    expect(normalizeEmail("")).toBeNull();
    expect(normalizeEmail(null)).toBeNull();
  });
});

describe("normalizePhone", () => {
  it("converts HU formats to E.164", () => {
    expect(normalizePhone("06 30 111 2233")).toBe("+36301112233");
    expect(normalizePhone("+36 1 234 5678")).toBe("+3612345678");
    expect(normalizePhone("0036 20 987 6543")).toBe("+36209876543");
  });
  it("rejects implausible numbers", () => {
    expect(normalizePhone("123")).toBeNull();
    expect(normalizePhone(null)).toBeNull();
  });
});

describe("domainFromUrl", () => {
  it("extracts and strips www", () => {
    expect(domainFromUrl("https://www.Example.hu/path")).toBe("example.hu");
    expect(domainFromUrl("example.hu")).toBe("example.hu");
  });
  it("returns null for non-domains", () => {
    expect(domainFromUrl("localhost")).toBeNull();
    expect(domainFromUrl("")).toBeNull();
  });
});

describe("normalizeCompanyName", () => {
  it("strips legal forms and accents-light", () => {
    expect(normalizeCompanyName("Tiszta Iroda Kft.")).toBe("tiszta iroda");
    expect(normalizeCompanyName("Őrszem Vagyonvédelem Zrt.")).toBe("őrszem vagyonvédelem");
  });
});

describe("isValidHuVat", () => {
  it("accepts a valid check digit", () => {
    expect(isValidHuVat("10773381")).toBe(true);
    expect(isValidHuVat("10773381-2-41")).toBe(true);
  });
  it("rejects a bad check digit or wrong length", () => {
    expect(isValidHuVat("10773382")).toBe(false);
    expect(isValidHuVat("123")).toBe(false);
    expect(isValidHuVat(null)).toBe(false);
  });
});
