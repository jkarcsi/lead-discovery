import { describe, it, expect } from "vitest";
import { cpvToCategories } from "../src/lib/cpv.js";

describe("cpvToCategories", () => {
  it("maps cleaning / IT / security CPV codes", () => {
    expect(cpvToCategories(["90919200-4"])).toEqual(["cleaning"]);
    expect(cpvToCategories(["72500000-0"])).toEqual(["it-support"]);
    expect(cpvToCategories(["79713000-5"])).toEqual(["security"]);
  });

  it("maps HVAC and fire-safety", () => {
    expect(cpvToCategories(["45331000-6"])).toEqual(["hvac"]);
    expect(cpvToCategories(["35111000-5"])).toEqual(["fire-safety"]);
  });

  it("unions multiple codes and de-duplicates", () => {
    expect(cpvToCategories(["72500000-0", "72611000-6"])).toEqual(["it-support"]);
    expect(cpvToCategories(["90919200-4", "79713000-5"]).sort()).toEqual(["cleaning", "security"]);
  });

  it("ignores codes outside the mapping and malformed input", () => {
    expect(cpvToCategories(["03000000-1"])).toEqual([]); // agriculture
    expect(cpvToCategories(["", "n/a"])).toEqual([]);
    expect(cpvToCategories([])).toEqual([]);
  });
});
