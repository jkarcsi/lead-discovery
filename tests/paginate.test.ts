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
  it("collects all pages in order and reports the last non-empty page", async () => {
    const { fetchPage } = fakeSource(3);
    const out = await collectPages(fetchPage, { window: 2, maxPages: 50 });
    expect(out.items).toEqual(["1a", "1b", "2a", "2b", "3a", "3b"]);
    expect(out.lastPage).toBe(3);
  });

  it("respects maxPages even if more pages exist", async () => {
    const { fetchPage } = fakeSource(100);
    const out = await collectPages(fetchPage, { window: 4, maxPages: 2 });
    expect(out.items).toEqual(["1a", "1b", "2a", "2b"]);
    expect(out.lastPage).toBe(2);
  });

  it("resumes from startPage and reports an absolute lastPage", async () => {
    const { fetchPage, calls } = fakeSource(5);
    const out = await collectPages(fetchPage, { window: 2, maxPages: 50, startPage: 4 });
    expect(out.items).toEqual(["4a", "4b", "5a", "5b"]);
    expect(out.lastPage).toBe(5);
    expect(Math.min(...calls)).toBe(4); // never re-fetched pages 1-3
  });

  it("fetches within a window concurrently (one over-fetched window is fine)", async () => {
    const { fetchPage, calls } = fakeSource(2);
    await collectPages(fetchPage, { window: 3, maxPages: 50 });
    expect(calls.sort((a, b) => a - b)).toEqual([1, 2, 3]);
  });

  it("returns nothing (lastPage = startPage-1) when the first page is empty", async () => {
    const { fetchPage } = fakeSource(0);
    const out = await collectPages(fetchPage, { window: 2, maxPages: 10, startPage: 7 });
    expect(out.items).toEqual([]);
    expect(out.lastPage).toBe(6);
  });
});
