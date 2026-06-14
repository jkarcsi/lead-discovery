import { describe, it, expect } from "vitest";
import { teaorToCategories } from "../src/lib/teaor.js";

describe("teaorToCategories", () => {
  it("maps building cleaning (812x)", () => {
    expect(teaorToCategories(["8121"])).toEqual(["cleaning"]);
    expect(teaorToCategories(["8122"])).toEqual(["cleaning"]);
  });

  it("maps security (80xx) and fire protection (8425)", () => {
    expect(teaorToCategories(["8010"])).toEqual(["security"]);
    expect(teaorToCategories(["8425"])).toEqual(["fire-safety"]);
  });

  it("maps IT activities (620x / 9511) and HVAC (4322)", () => {
    expect(teaorToCategories(["6203"])).toEqual(["it-support"]);
    expect(teaorToCategories(["9511"])).toEqual(["it-support"]);
    expect(teaorToCategories(["4322"])).toEqual(["hvac"]);
  });

  it("accepts dotted codes and ignores unmapped/malformed", () => {
    expect(teaorToCategories(["81.21"])).toEqual(["cleaning"]);
    expect(teaorToCategories(["0150"])).toEqual([]); // farming
    expect(teaorToCategories(["", "x"])).toEqual([]);
  });
});
