// Batched persistence for a collected batch. Where the old path did ~3 DB
// round-trips per record (two suppression checks + a findUnique + a write), this
// does a handful per *batch*:
//   1. load the suppression set once (in memory),
//   2. plan in memory (dedupe within batch, drop suppressed),
//   3. one findMany for all existing keys,
//   4. one createMany for new leads + one readback for their ids,
//   5. existing leads updated inside a single transaction,
//   6. one createMany for all audit rows.
// Counts stay identical to the per-record path.

import type { Prisma } from "@prisma/client";
import { db } from "../db.js";
import { mergeLead } from "../lib/dedupe.js";
import { qualityScore } from "../lib/quality.js";
import { leadInputFromRow } from "../lib/leadRow.js";
import { planIngest } from "../lib/ingestPlan.js";
import type { LeadInput } from "../types.js";

export type StoreStats = { created: number; merged: number; skippedSuppressed: number };

function leadCreateData(key: string, lead: LeadInput): Prisma.LeadCreateManyInput {
  return {
    ...lead,
    dedupeKey: key,
    categories: JSON.stringify(lead.categories),
    qualityScore: qualityScore(lead),
  };
}

export async function storeLeads(leads: LeadInput[], source: string): Promise<StoreStats> {
  const suppressed = new Set(
    (await db.suppression.findMany({ select: { value: true } })).map((s) => s.value),
  );
  const plan = planIngest(leads, suppressed);
  const stats: StoreStats = { created: 0, merged: 0, skippedSuppressed: plan.suppressedCount };

  const existingRows = await db.lead.findMany({
    where: { dedupeKey: { in: plan.items.map((i) => i.key) } },
  });
  const existingByKey = new Map(existingRows.map((r) => [r.dedupeKey, r]));

  const creates: Prisma.LeadCreateManyInput[] = [];
  const updates: Prisma.PrismaPromise<unknown>[] = [];
  const audits: Prisma.AuditEventCreateManyInput[] = [];

  for (const item of plan.items) {
    const existing = existingByKey.get(item.key);
    if (existing) {
      const merged = mergeLead(leadInputFromRow(existing), item.lead);
      updates.push(
        db.lead.update({
          where: { dedupeKey: item.key },
          data: {
            ...merged,
            categories: JSON.stringify(merged.categories),
            qualityScore: qualityScore(merged),
          },
        }),
      );
      stats.merged += item.inputCount;
      audits.push({ leadId: existing.id, type: "MERGED", meta: JSON.stringify({ source, count: item.inputCount }) });
    } else {
      stats.created += 1;
      stats.merged += item.inputCount - 1;
      creates.push(leadCreateData(item.key, item.lead));
    }
  }

  if (updates.length) await db.$transaction(updates);

  if (creates.length) {
    await db.lead.createMany({ data: creates });
    // Read back ids to attach a COLLECTED provenance row to each new lead.
    const createdRows = await db.lead.findMany({
      where: { dedupeKey: { in: creates.map((c) => c.dedupeKey) } },
      select: { id: true, source: true, sourceUrl: true, sourceLicense: true },
    });
    for (const row of createdRows) {
      audits.push({
        leadId: row.id,
        type: "COLLECTED",
        meta: JSON.stringify({ source: row.source, sourceUrl: row.sourceUrl, license: row.sourceLicense }),
      });
    }
  }

  if (plan.suppressedCount > 0) {
    audits.push({ leadId: null, type: "SUPPRESSED_SKIP", meta: JSON.stringify({ source, count: plan.suppressedCount }) });
  }

  if (audits.length) await db.auditEvent.createMany({ data: audits });

  return stats;
}
