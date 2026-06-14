// Bounded-concurrency async map: run `fn` over `items` with at most `limit`
// promises in flight at once. The throughput workhorse — lets connectors fetch
// and parse many sources in parallel without unbounded fan-out. Results are
// returned in input order regardless of completion order.

export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  const effectiveLimit = Math.max(1, Math.min(limit, items.length || 1));
  let next = 0;

  async function worker(): Promise<void> {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await fn(items[index], index);
    }
  }

  const workers = Array.from({ length: effectiveLimit }, () => worker());
  await Promise.all(workers);
  return results;
}
