// Concurrent pagination. Fetches pages in windows of `window` at a time (via
// mapWithConcurrency) and stops at the first empty page — the usual "no more
// results" signal. `fetchPage` is injected so this stays I/O-free and testable;
// connectors pass a fixture- or network-backed page fetcher.

import { mapWithConcurrency } from "./concurrency.js";

export async function collectPages<T>(
  fetchPage: (page: number) => Promise<T[]>,
  opts: { window: number; maxPages: number; startPage?: number },
): Promise<T[]> {
  const out: T[] = [];
  const window = Math.max(1, opts.window);
  let page = opts.startPage ?? 1;

  while (page <= opts.maxPages) {
    const end = Math.min(page + window - 1, opts.maxPages);
    const pageNumbers: number[] = [];
    for (let p = page; p <= end; p++) pageNumbers.push(p);

    const batches = await mapWithConcurrency(pageNumbers, window, fetchPage);

    // An empty page marks the end; everything after it in this window is end too.
    let reachedEnd = false;
    for (const batch of batches) {
      if (batch.length === 0) {
        reachedEnd = true;
        break;
      }
      out.push(...batch);
    }
    if (reachedEnd) break;
    page = end + 1;
  }

  return out;
}
