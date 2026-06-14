import { describe, it, expect } from "vitest";
import { collectPages } from "../src/lib/paginate.js";

// A fake source: `total` pages each with 2 items, empty beyond that.
function fakeSource(total: number) {
  const calls: number[] = [];
  const fetchPage = async (page: number): Promise<string[]> => {
    calls.push(page);
    return page <= total ? [`${page}a`, `${page}b`] : [];
  };
  return { fetchPage, calls };
}

describe("collectPages", () => {
  it("collects all pages in order and stops at the first empty page", async () => {
    const { fetchPage } = fakeSource(3);
    const out = await collectPages(fetchPage, { window: 2, maxPages: 50 });
    expect(out).toEqual(["1a", "1b", "2a", "2b", "3a", "3b"]);
  });

  it("respects maxPages even if more pages exist", async () => {
    const { fetchPage } = fakeSource(100);
    const out = await collectPages(fetchPage, { window: 4, maxPages: 2 });
    expect(out).toEqual(["1a", "1b", "2a", "2b"]);
  });

  it("fetches within a window concurrently (one over-fetched window is fine)", async () => {
    const { fetchPage, calls } = fakeSource(2);
    await collectPages(fetchPage, { window: 3, maxPages: 50 });
    // First window 1-3 is fetched together; page 3 is empty → stop.
    expect(calls.sort((a, b) => a - b)).toEqual([1, 2, 3]);
  });

  it("returns nothing when the first page is already empty", async () => {
    const { fetchPage } = fakeSource(0);
    expect(await collectPages(fetchPage, { window: 2, maxPages: 10 })).toEqual([]);
  });
});
