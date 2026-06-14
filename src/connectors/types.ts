import type { RawBusiness } from "../types.js";

export type CollectOptions = {
  regionId: string;
  // false → read offline fixtures (default, fully deterministic). true → hit the
  // real source over the network (rate-limited, identified UA).
  live: boolean;
  limit?: number;
  // Resume paginated sources from this page (incremental crawl). Ignored by
  // single-shot sources.
  startPage?: number;
};

// A connector's output. Paginated sources also report a `cursor` so the pipeline
// can persist where the crawl reached and resume next run.
export type CollectResult = {
  records: RawBusiness[];
  cursor?: { lastPage: number };
};

export type Connector = {
  id: string;
  // Source data licence recorded as provenance on every produced lead.
  license: string;
  collect(opts: CollectOptions): Promise<CollectResult>;
};
