import { describe, it, expect } from "vitest";
import { mapWithConcurrency } from "../src/lib/concurrency.js";

describe("mapWithConcurrency", () => {
  it("preserves input order regardless of completion order", async () => {
    const out = await mapWithConcurrency([10, 1, 5], 3, async (ms, i) => {
      await new Promise((r) => setTimeout(r, ms));
      return i;
    });
    expect(out).toEqual([0, 1, 2]);
  });

  it("never exceeds the concurrency limit", async () => {
    let inFlight = 0;
    let peak = 0;
    await mapWithConcurrency(Array.from({ length: 20 }, (_, i) => i), 4, async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return null;
    });
    expect(peak).toBeLessThanOrEqual(4);
    expect(peak).toBeGreaterThan(1);
  });

  it("processes every item exactly once", async () => {
    const seen: number[] = [];
    await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (x) => {
      seen.push(x);
      return x;
    });
    expect(seen.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it("handles an empty list", async () => {
    expect(await mapWithConcurrency([], 4, async (x) => x)).toEqual([]);
  });
});
