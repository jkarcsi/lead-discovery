// Concurrent pagination. Fetches pages in windows of `window` at a time (via
// mapWithConcurrency) and stops at the first empty page — the usual "no more
// results" signal. `fetchPage` is injected so this stays I/O-free and testable;
// connectors pass a fixture- or network-backed page fetcher.

import { mapWithConcurrency } from "./concurrency.js";

// `items` plus `lastPage`: the highest page that returned results (or
// startPage-1 if none did) — the resumable crawl cursor.
export type PageHarvest<T> = { items: T[]; lastPage: number };

export async function collectPages<T>(
  fetchPage: (page: number) => Promise<T[]>,
  opts: { window: number; maxPages: number; startPage?: number },
): Promise<PageHarvest<T>> {
  const out: T[] = [];
  const window = Math.max(1, opts.window);
  const start = opts.startPage ?? 1;
  let page = start;
  let lastPage = start - 1;

  while (page <= opts.maxPages) {
    const end = Math.min(page + window - 1, opts.maxPages);
    const pageNumbers: number[] = [];
    for (let p = page; p <= end; p++) pageNumbers.push(p);

    const batches = await mapWithConcurrency(pageNumbers, window, fetchPage);

    // An empty page marks the end; everything after it in this window is end too.
    let reachedEnd = false;
    for (let i = 0; i < batches.length; i++) {
      if (batches[i].length === 0) {
        reachedEnd = true;
        break;
      }
      out.push(...batches[i]);
      lastPage = pageNumbers[i];
    }
    if (reachedEnd) break;
    page = end + 1;
  }

  return { items: out, lastPage };
}
