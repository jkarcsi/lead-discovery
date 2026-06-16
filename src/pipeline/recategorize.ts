// Re-run categorization over already-stored leads and REPLACE their categories.
// Needed because the ingest merge *unions* categories, so a keyword fix can't
// remove a previously-mis-assigned category by re-collection alone — only an
// explicit recompute can. Uses the persisted `classificationText` (the exact
// input the categorizer saw at collection); falls back to name + brand for rows
// collected before that field existed.

import { db } from "../db.js";
import { categorize } from "../lib/categorize.js";
import { recordAudit } from "../lib/audit.js";

export type RecategorizeOptions = { limit?: number; dryRun?: boolean };
export type RecategorizeStats = {
  scanned: number;
  changed: number; // categories differed and were updated
  cleared: number; // had categories, now has none (all were false positives)
  fallback: number; // no stored classificationText, used name + brand
};

function sameSet(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((x) => b.includes(x));
}

export async function recategorize(opts: RecategorizeOptions = {}): Promise<RecategorizeStats> {
  const leads = await db.lead.findMany({
    select: { id: true, legalName: true, brandName: true, classificationText: true, categories: true },
    ...(opts.limit ? { take: opts.limit } : {}),
  });

  const stats: RecategorizeStats = { scanned: 0, changed: 0, cleared: 0, fallback: 0 };
  for (const lead of leads) {
    stats.scanned++;
    const hasText = !!lead.classificationText;
    if (!hasText) stats.fallback++;
    const text = lead.classificationText ?? [lead.legalName, lead.brandName].filter(Boolean).join(" ");

    const next = categorize(text);
    const prev = JSON.parse(lead.categories) as string[];
    if (sameSet(prev, next)) continue;

    stats.changed++;
    if (prev.length > 0 && next.length === 0) stats.cleared++;
    if (!opts.dryRun) {
      await db.lead.update({ where: { id: lead.id }, data: { categories: JSON.stringify(next) } });
      await recordAudit(lead.id, "RECATEGORIZED", { from: prev, to: next });
    }
  }
  return stats;
}
