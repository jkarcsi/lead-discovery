// Pure retention / erasure decisions (no I/O). Decides, for a single stored
// lead, whether it must be purged. Two independent grounds:
//
//   1. SUPPRESSED — the lead's email/domain is now on the do-not-contact list.
//      Suppression at ingest only blocks *future* stores; a lead collected
//      *before* its suppression must be actively erased here (GDPR Art. 17).
//   2. PERSONAL_DATA_EXPIRED — a never-engaged personal-data lead has aged past
//      the retention window (storage limitation, GDPR Art. 5(1)(e)).
//
// The DB-touching application of this lives in `pipeline/purge.ts`.

import { leadSuppressionKeys } from "./suppressionMatch.js";

export type RetentionPolicy = {
  // Purge never-engaged personal-data leads older than this many days.
  personalDataRetentionDays: number;
};

export type RetentionLeadView = {
  email: string | null;
  domain: string | null;
  isPersonalData: boolean;
  lifecycle: string; // NEW | CONTACTED | RESPONDED | REGISTERED | SUPPRESSED
  collectedAt: Date;
};

export type PurgeReason = "SUPPRESSED" | "PERSONAL_DATA_EXPIRED";

const DAY_MS = 86_400_000;

// Returns the reason this lead must be purged, or null to keep it. Suppression
// takes precedence (it applies regardless of lead type or age).
export function purgeDecision(
  lead: RetentionLeadView,
  ctx: { suppressedValues: Set<string>; policy: RetentionPolicy; now: Date },
): PurgeReason | null {
  for (const key of leadSuppressionKeys(lead)) {
    if (ctx.suppressedValues.has(key)) return "SUPPRESSED";
  }

  if (lead.isPersonalData && lead.lifecycle === "NEW") {
    const ageDays = (ctx.now.getTime() - lead.collectedAt.getTime()) / DAY_MS;
    if (ageDays >= ctx.policy.personalDataRetentionDays) return "PERSONAL_DATA_EXPIRED";
  }

  return null;
}
