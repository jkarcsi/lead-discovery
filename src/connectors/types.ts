import type { RawBusiness } from "../types.js";

export type CollectOptions = {
  regionId: string;
  // false → read offline fixtures (default, fully deterministic). true → hit the
  // real source over the network (rate-limited, identified UA).
  live: boolean;
  limit?: number;
};

export type Connector = {
  id: string;
  // Source data licence recorded as provenance on every produced lead.
  license: string;
  collect(opts: CollectOptions): Promise<RawBusiness[]>;
};
