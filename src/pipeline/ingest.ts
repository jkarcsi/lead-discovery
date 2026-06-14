// The collection pipeline: connector → transform (normalize + categorize) →
// batched store (dedupe-merge + provenance). Tuned for throughput — multiple
// regions are fetched in parallel (network-bound) and persisted in one batched
// write (see store.ts). Paginated sources resume from a saved crawl cursor so
// re-runs only fetch new pages (see crawlState.ts); --full forces a fresh scan.

import { config } from "../config.js";
import { getConnector } from "../connectors/index.js";
import { mapWithConcurrency } from "../lib/concurrency.js";
import { transform } from "./transform.js";
import { storeLeads } from "./store.js";
import { getCursors, saveCursor } from "./crawlState.js";
import type { LeadInput } from "../types.js";

export type IngestOptions = {
  source: string;
  regionIds: string[];
  live: boolean;
  limit?: number;
  full?: boolean; // ignore saved cursors and re-scan from page 1
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

type RegionHarvest = {
  regionId: string;
  leads: LeadInput[];
  lastPage?: number; // present for paginated sources
};

// Fetch + normalize one region's businesses (no DB work).
async function collectRegion(
  source: string,
  regionId: string,
  live: boolean,
  limit: number | undefined,
  startPage: number,
): Promise<RegionHarvest> {
  const connector = getConnector(source);
  const result = await connector.collect({ regionId, live, limit, startPage });
  return {
    regionId,
    leads: result.records.map((r) => toLeadInput(transform(r), regionId)),
    lastPage: result.cursor?.lastPage,
  };
}

export async function ingest(opts: IngestOptions): Promise<IngestStats> {
  // Resume cursors (one query up front) unless --full.
  const cursors = opts.full ? new Map<string, number>() : await getCursors(opts.source, opts.regionIds);

  // Fetch all regions concurrently (the slow, network-bound part). One region
  // failing (missing fixture, network blip) must not abort the whole crawl.
  const failedRegions: string[] = [];
  const harvests = await mapWithConcurrency(
    opts.regionIds,
    config.fetchConcurrency,
    async (regionId): Promise<RegionHarvest> => {
      const saved = cursors.get(regionId) ?? 0;
      const startPage = saved > 0 ? saved : 1; // re-fetch the last page (cheap) then continue
      try {
        return await collectRegion(opts.source, regionId, opts.live, opts.limit, startPage);
      } catch (err) {
        failedRegions.push(regionId);
        console.warn(`  ! region "${regionId}" failed: ${err instanceof Error ? err.message : err}`);
        return { regionId, leads: [] };
      }
    },
  );

  const leads = harvests.flatMap((h) => h.leads);
  const store = await storeLeads(leads, opts.source);

  // Persist updated cursors for paginated regions that didn't fail.
  const failed = new Set(failedRegions);
  for (const h of harvests) {
    if (h.lastPage === undefined || failed.has(h.regionId)) continue;
    const saved = cursors.get(h.regionId) ?? 0;
    await saveCursor(opts.source, h.regionId, Math.max(saved, h.lastPage), h.leads.length);
  }

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
