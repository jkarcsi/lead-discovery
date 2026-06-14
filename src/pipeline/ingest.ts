// The collection pipeline: connector → transform (normalize + categorize) →
// batched store (dedupe-merge + provenance). Tuned for throughput — multiple
// regions are fetched in parallel (network-bound) and persisted in one batched
// write (see store.ts).

import { config } from "../config.js";
import { getConnector } from "../connectors/index.js";
import { mapWithConcurrency } from "../lib/concurrency.js";
import { transform } from "./transform.js";
import { storeLeads } from "./store.js";
import type { LeadInput } from "../types.js";

export type IngestOptions = {
  source: string;
  regionIds: string[];
  live: boolean;
  limit?: number;
};

export type IngestStats = {
  source: string;
  regions: string[];
  fetched: number;
  created: number;
  merged: number;
  skippedSuppressed: number;
  failedRegions: string[];
};

function toLeadInput(raw: ReturnType<typeof transform>, fallbackRegion: string): LeadInput {
  return { ...raw, regionId: raw.regionId ?? fallbackRegion };
}

// Fetch + normalize one region's raw businesses (no DB work).
async function collectRegion(
  source: string,
  regionId: string,
  live: boolean,
  limit?: number,
): Promise<LeadInput[]> {
  const connector = getConnector(source);
  const raw = await connector.collect({ regionId, live, limit });
  return raw.map((r) => toLeadInput(transform(r), regionId));
}

export async function ingest(opts: IngestOptions): Promise<IngestStats> {
  // Fetch all regions concurrently (the slow, network-bound part), then persist
  // everything in a single batched write. One region failing (missing fixture,
  // network blip) must not abort the whole crawl.
  const failedRegions: string[] = [];
  const perRegion = await mapWithConcurrency(
    opts.regionIds,
    config.fetchConcurrency,
    async (regionId) => {
      try {
        return await collectRegion(opts.source, regionId, opts.live, opts.limit);
      } catch (err) {
        failedRegions.push(regionId);
        console.warn(`  ! region "${regionId}" failed: ${err instanceof Error ? err.message : err}`);
        return [] as LeadInput[];
      }
    },
  );
  const leads = perRegion.flat();

  const store = await storeLeads(leads, opts.source);

  return {
    source: opts.source,
    regions: opts.regionIds,
    fetched: leads.length,
    created: store.created,
    merged: store.merged,
    skippedSuppressed: store.skippedSuppressed,
    failedRegions,
  };
}
