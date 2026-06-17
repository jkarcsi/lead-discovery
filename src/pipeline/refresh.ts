// Scheduled incremental refresh: collect every (non-gated) source across the
// given regions — resuming paginated sources from their cursors — then run the
// enrichment steps. The one command an operator/cron invokes to keep the
// database current. Sources run sequentially (SQLite single-writer).

import { config } from "../config.js";
import { listConnectors } from "../connectors/index.js";
import { ingest } from "./ingest.js";
import { verify } from "./verify.js";
import { navVerify } from "./navVerify.js";
import { enrichContacts, type EnrichOptions } from "./enrich.js";
import { placesEnrich } from "./placesEnrich.js";
import { aiCategorize } from "./aiCategorize.js";

export type RefreshOptions = {
  regionIds: string[];
  live?: boolean;
  // Step-level progress lines (each source, each enrichment phase) so a long
  // live refresh isn't silent until the end. Omitted = no logging.
  log?: (line: string) => void;
  // Forwarded to the contact-enrichment step (the slow website-scraping phase).
  onProgress?: EnrichOptions["onProgress"];
};

export type RefreshStats = {
  sources: { source: string; fetched: number; created: number; merged: number }[];
  verified: number;
  navChecked: number;
  contactsEnriched: number;
  placesEnriched: number;
  aiCategorized: number;
};

export async function refresh(opts: RefreshOptions): Promise<RefreshStats> {
  const live = opts.live ?? false;
  const log = opts.log ?? (() => {});
  // EVNY (sensitive) only when explicitly enabled.
  const sources = listConnectors().filter((s) => s !== "evny" || config.evnyEnabled);

  const perSource: RefreshStats["sources"] = [];
  for (const [i, source] of sources.entries()) {
    log(`[${i + 1}/${sources.length}] collecting ${source}…`);
    const s = await ingest({ source, regionIds: opts.regionIds, live });
    perSource.push({ source, fetched: s.fetched, created: s.created, merged: s.merged });
    const failed = s.failedRegions.length ? ` (${s.failedRegions.length} region(s) failed)` : "";
    log(`  ${source.padEnd(14)} +${s.created} new, ${s.merged} merged${failed}`);
  }

  log("verifying VAT against VIES…");
  const v = await verify({ live });
  log("checking tax status against NAV…");
  const n = await navVerify({ live });
  log("enriching contacts from websites…");
  const e = await enrichContacts({ live, onProgress: opts.onProgress });
  log("enriching from Google Places…");
  const p = await placesEnrich({ live });

  // AI categorization runs last (it needs the website text enrich just gathered).
  // Live mode needs an API key; skip it on a keyless live run rather than crash.
  let aiCategorized = 0;
  if (!live || config.anthropicApiKey) {
    log("AI-categorizing leftover website text…");
    const a = await aiCategorize({ live });
    aiCategorized = a.categorized;
  } else {
    log("skipping AI categorization (no ANTHROPIC_API_KEY set)");
  }

  return {
    sources: perSource,
    verified: v.valid,
    navChecked: n.checked,
    contactsEnriched: e.enriched,
    placesEnriched: p.enriched,
    aiCategorized,
  };
}
