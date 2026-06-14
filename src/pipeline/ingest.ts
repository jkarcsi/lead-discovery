// The collection pipeline:
//   connector → transform (normalize + categorize) → suppression check →
//   dedupe-key upsert (merge on collision) → Lead store + audit trail.
//
// This is Phase-1 work: it only *collects and categorizes*. No outreach happens
// anywhere here — that is a separate, counsel-gated phase (see docs/LEGAL.md).

import { db } from "../db.js";
import { getConnector } from "../connectors/index.js";
import { transform } from "./transform.js";
import { dedupeKey, mergeLead } from "../lib/dedupe.js";
import { qualityScore } from "../lib/quality.js";
import { isSuppressed, isDomainSuppressed } from "../lib/suppression.js";
import { recordAudit } from "../lib/audit.js";
import { rowToLeadInput } from "../lib/leadRow.js";
import type { LeadInput } from "../types.js";

export type IngestOptions = {
  source: string;
  regionId: string;
  live: boolean;
  limit?: number;
};

export type IngestStats = {
  source: string;
  regionId: string;
  fetched: number;
  created: number;
  merged: number;
  skippedSuppressed: number;
};

function toLeadInput(raw: ReturnType<typeof transform>, fallbackRegion: string): LeadInput {
  return { ...raw, regionId: raw.regionId ?? fallbackRegion };
}

export async function ingest(opts: IngestOptions): Promise<IngestStats> {
  const connector = getConnector(opts.source);
  const raw = await connector.collect({
    regionId: opts.regionId,
    live: opts.live,
    limit: opts.limit,
  });

  const stats: IngestStats = {
    source: opts.source,
    regionId: opts.regionId,
    fetched: raw.length,
    created: 0,
    merged: 0,
    skippedSuppressed: 0,
  };

  for (const r of raw) {
    const lead = toLeadInput(transform(r), opts.regionId);

    // Never (re)store contactable data for a suppressed business.
    if ((await isSuppressed(lead.email)) || (await isDomainSuppressed(lead.domain))) {
      stats.skippedSuppressed++;
      await recordAudit(null, "SUPPRESSED_SKIP", { source: lead.source, domain: lead.domain });
      continue;
    }

    const key = dedupeKey(lead);
    const existing = await db.lead.findUnique({ where: { dedupeKey: key } });

    if (existing) {
      const merged = mergeLead(rowToLeadInput(existing), lead);
      await db.lead.update({
        where: { dedupeKey: key },
        data: {
          ...merged,
          categories: JSON.stringify(merged.categories),
          qualityScore: qualityScore(merged),
        },
      });
      stats.merged++;
      await recordAudit(existing.id, "MERGED", { source: lead.source });
    } else {
      const created = await db.lead.create({
        data: {
          ...lead,
          dedupeKey: key,
          categories: JSON.stringify(lead.categories),
          qualityScore: qualityScore(lead),
        },
      });
      stats.created++;
      await recordAudit(created.id, "COLLECTED", {
        source: lead.source,
        sourceUrl: lead.sourceUrl,
        license: lead.sourceLicense,
      });
    }
  }

  return stats;
}
