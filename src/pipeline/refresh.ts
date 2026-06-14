// Scheduled incremental refresh: collect every (non-gated) source across the
// given regions — resuming paginated sources from their cursors — then run the
// enrichment steps. The one command an operator/cron invokes to keep the
// database current. Sources run sequentially (SQLite single-writer).

import { config } from "../config.js";
import { listConnectors } from "../connectors/index.js";
import { ingest } from "./ingest.js";
import { verify } from "./verify.js";
import { navVerify } from "./navVerify.js";
import { enrichContacts } from "./enrich.js";
import { placesEnrich } from "./placesEnrich.js";

export type RefreshOptions = { regionIds: string[]; live?: boolean };

export type RefreshStats = {
  sources: { source: string; fetched: number; created: number; merged: number }[];
  verified: number;
  navChecked: number;
  contactsEnriched: number;
  placesEnriched: number;
};

export async function refresh(opts: RefreshOptions): Promise<RefreshStats> {
  const live = opts.live ?? false;
  // EVNY (sensitive) only when explicitly enabled.
  const sources = listConnectors().filter((s) => s !== "evny" || config.evnyEnabled);

  const perSource: RefreshStats["sources"] = [];
  for (const source of sources) {
    const s = await ingest({ source, regionIds: opts.regionIds, live });
    perSource.push({ source, fetched: s.fetched, created: s.created, merged: s.merged });
  }

  const v = await verify({ live });
  const n = await navVerify({ live });
  const e = await enrichContacts({ live });
  const p = await placesEnrich({ live });

  return {
    sources: perSource,
    verified: v.valid,
    navChecked: n.checked,
    contactsEnriched: e.enriched,
    placesEnriched: p.enriched,
  };
}
