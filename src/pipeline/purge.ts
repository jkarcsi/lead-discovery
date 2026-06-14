// Retention / erasure job (GDPR Art. 5(1)(e) data minimization, Art. 17 right
// to erasure, and the suppression guarantee). Deletes leads the pure policy in
// `lib/retention.ts` marks for purge:
//
//   - personal-data leads never engaged past the retention horizon, and
//   - any lead whose contact now matches the global suppression list (covers
//     rows stored *before* an opt-out/bounce arrived — ingest only blocks
//     future re-collection, not the past).
//
// A surviving, NON-identifying audit row is written for each deletion: it uses
// leadId=null (so the cascade delete doesn't take it with the lead) and records
// only the reason, region, source and personal-data flag — never the contact
// data we are erasing. That keeps the accountability trail without re-storing
// what we just deleted.

import { db } from "../db.js";
import { recordAudit } from "../lib/audit.js";
import {
  DEFAULT_RETENTION,
  purgeReason,
  type PurgeReason,
  type RetentionPolicy,
} from "../lib/retention.js";

export type PurgeOptions = {
  now?: Date;
  policy?: RetentionPolicy;
  // Report what would be deleted without touching the store.
  dryRun?: boolean;
};

export type PurgeStats = {
  scanned: number;
  suppressed: number;
  retentionExpired: number;
  purged: number;
  dryRun: boolean;
};

export async function purge(opts: PurgeOptions = {}): Promise<PurgeStats> {
  const now = opts.now ?? new Date();
  const policy = opts.policy ?? DEFAULT_RETENTION;
  const dryRun = opts.dryRun ?? false;

  // Load the suppression list once into lookup sets (values are already
  // normalized lowercase as stored by addSuppression).
  const suppressions = await db.suppression.findMany();
  const suppressedEmails = new Set(
    suppressions.filter((s) => s.kind === "EMAIL").map((s) => s.value),
  );
  const suppressedDomains = new Set(
    suppressions.filter((s) => s.kind === "DOMAIN").map((s) => s.value),
  );

  const leads = await db.lead.findMany();
  const stats: PurgeStats = {
    scanned: leads.length,
    suppressed: 0,
    retentionExpired: 0,
    purged: 0,
    dryRun,
  };

  for (const lead of leads) {
    const reason: PurgeReason | null = purgeReason(
      lead,
      now,
      policy,
      suppressedEmails,
      suppressedDomains,
    );
    if (!reason) continue;

    if (reason === "suppressed") stats.suppressed++;
    else stats.retentionExpired++;

    if (!dryRun) {
      // Audit first (leadId=null so it outlives the cascade), then delete.
      await recordAudit(null, "PURGED", {
        reason,
        regionId: lead.regionId,
        source: lead.source,
        isPersonalData: lead.isPersonalData,
      });
      await db.lead.delete({ where: { id: lead.id } });
      stats.purged++;
    }
  }

  return stats;
}
