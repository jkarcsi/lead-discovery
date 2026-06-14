import { describe, it, expect } from "vitest";
import { parseNavResponse, navRiskReasons } from "../src/lib/navParse.js";

describe("parseNavResponse", () => {
  it("normalizes a healthy taxpayer", () => {
    expect(parseNavResponse({ taxStatus: "active", debtFree: true, employeeCount: 12 })).toEqual({
      taxStatus: "ACTIVE",
      debtFree: true,
      employeeCount: 12,
    });
  });

  it("maps unknown/missing status to UNKNOWN and missing fields to null", () => {
    expect(parseNavResponse({})).toEqual({
      taxStatus: "UNKNOWN",
      debtFree: null,
      employeeCount: null,
    });
    expect(parseNavResponse({ taxStatus: "weird" }).taxStatus).toBe("UNKNOWN");
  });

  it("rejects a negative / non-numeric headcount", () => {
    expect(parseNavResponse({ employeeCount: -5 }).employeeCount).toBeNull();
    expect(parseNavResponse({ employeeCount: "x" }).employeeCount).toBeNull();
  });

  it("truncates a fractional headcount", () => {
    expect(parseNavResponse({ employeeCount: 7.9 }).employeeCount).toBe(7);
  });
});

describe("navRiskReasons", () => {
  it("is clean for an active, debt-free taxpayer", () => {
    expect(navRiskReasons({ taxStatus: "ACTIVE", debtFree: true, employeeCount: 10 })).toEqual([]);
  });

  it("flags suspended / cancelled tax numbers", () => {
    expect(navRiskReasons({ taxStatus: "SUSPENDED", debtFree: true, employeeCount: null })).toContain(
      "tax number suspended",
    );
    expect(navRiskReasons({ taxStatus: "CANCELLED", debtFree: true, employeeCount: null })).toContain(
      "tax number cancelled",
    );
  });

  it("flags tax debt", () => {
    expect(navRiskReasons({ taxStatus: "ACTIVE", debtFree: false, employeeCount: null })).toContain(
      "has tax debt (not köztartozásmentes)",
    );
  });
});
