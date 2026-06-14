// Retention / erasure job. Applies the pure `purgeDecision` to every stored
// lead and deletes those that must go: now-suppressed leads (closing the gap
// where suppression at ingest only blocks future stores) and never-engaged
// personal-data leads past the retention window.
//
// Each erasure leaves a DETACHED audit row (leadId = null) so the fact of the
// purge survives the lead's own cascade delete, and the meta carries no
// personal data — only the pseudonymous lead id, source, region, and reason.

import { db } from "../db.js";
import { config } from "../config.js";
import { recordAudit } from "../lib/audit.js";
import { purgeDecision, type RetentionPolicy } from "../lib/retention.js";

export type PurgeOptions = {
  dryRun?: boolean;
  now?: Date;
  policy?: RetentionPolicy;
};

export type PurgeStats = {
  scanned: number;
  suppressed: number;
  personalDataExpired: number;
  dryRun: boolean;
};

export async function purge(opts: PurgeOptions = {}): Promise<PurgeStats> {
  const now = opts.now ?? new Date();
  const policy = opts.policy ?? {
    personalDataRetentionDays: config.personalDataRetentionDays,
  };
  const dryRun = opts.dryRun ?? false;

  const suppressedValues = new Set(
    (await db.suppression.findMany({ select: { value: true } })).map((s) => s.value),
  );

  const leads = await db.lead.findMany({
    select: {
      id: true,
      email: true,
      domain: true,
      isPersonalData: true,
      lifecycle: true,
      collectedAt: true,
      source: true,
      regionId: true,
    },
  });

  const stats: PurgeStats = {
    scanned: leads.length,
    suppressed: 0,
    personalDataExpired: 0,
    dryRun,
  };

  for (const lead of leads) {
    const reason = purgeDecision(lead, { suppressedValues, policy, now });
    if (!reason) continue;

    if (reason === "SUPPRESSED") stats.suppressed++;
    else stats.personalDataExpired++;

    if (dryRun) continue;

    await recordAudit(null, "PURGED", {
      leadId: lead.id,
      reason,
      source: lead.source,
      regionId: lead.regionId,
    });
    await db.lead.delete({ where: { id: lead.id } });
  }

  return stats;
}
