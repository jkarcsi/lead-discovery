// Pure retention/erasure policy (no I/O, fully unit-testable). Decides which
// stored leads must be deleted to honor GDPR data-minimization (Art. 5(1)(e))
// and the suppression guarantee. Two independent grounds:
//
//   1. retention horizon — a personal-data lead that was never engaged
//      (lifecycle still NEW) is purged once it is older than the policy's
//      horizon. Business (non-personal) data is kept and re-verified instead.
//   2. suppression — a lead whose contact now matches the global suppression
//      list must be erased, even if it was stored *before* the opt-out/bounce
//      arrived (ingest only blocks future re-collection, not past rows).
//
// Side-effecting orchestration (querying, deleting, audit) lives in
// `src/pipeline/purge.ts`; this module only computes the decision.

export type RetentionPolicy = {
  // Purge never-engaged personal-data leads older than this many months.
  personalDataMaxAgeMonths: number;
};

export const DEFAULT_RETENTION: RetentionPolicy = {
  personalDataMaxAgeMonths: 12,
};

export type PurgeReason = "suppressed" | "retention_expired";

// Minimal shape the decision needs — matches a stored Lead row.
export type RetentionLead = {
  isPersonalData: boolean;
  lifecycle: string;
  collectedAt: Date;
  email: string | null;
  domain: string | null;
};

const MS_PER_MONTH = 1000 * 60 * 60 * 24 * 30.437; // avg Gregorian month

// "Never engaged" = still in the initial lifecycle. Anything past NEW
// (CONTACTED/RESPONDED/REGISTERED) reflects a relationship we must keep records
// of, so retention purge does not touch it.
function neverEngaged(lifecycle: string): boolean {
  return lifecycle === "NEW";
}

export function isExpiredPersonalLead(
  lead: Pick<RetentionLead, "isPersonalData" | "lifecycle" | "collectedAt">,
  now: Date,
  policy: RetentionPolicy = DEFAULT_RETENTION,
): boolean {
  if (!lead.isPersonalData) return false;
  if (!neverEngaged(lead.lifecycle)) return false;
  const ageMonths = (now.getTime() - lead.collectedAt.getTime()) / MS_PER_MONTH;
  return ageMonths >= policy.personalDataMaxAgeMonths;
}

// True if a lead's email (or its domain) is on the suppression list. The sets
// hold already-normalized lowercase values, as stored by `addSuppression`.
export function isLeadSuppressed(
  lead: Pick<RetentionLead, "email" | "domain">,
  suppressedEmails: Set<string>,
  suppressedDomains: Set<string>,
): boolean {
  if (lead.email) {
    const e = lead.email.trim().toLowerCase();
    if (suppressedEmails.has(e)) return true;
    const emailDomain = e.split("@")[1];
    if (emailDomain && suppressedDomains.has(emailDomain)) return true;
  }
  if (lead.domain && suppressedDomains.has(lead.domain.trim().toLowerCase())) return true;
  return false;
}

// The single decision: why (if at all) this lead must be purged. Suppression
// takes precedence over the retention horizon (it is the stronger obligation).
export function purgeReason(
  lead: RetentionLead,
  now: Date,
  policy: RetentionPolicy,
  suppressedEmails: Set<string>,
  suppressedDomains: Set<string>,
): PurgeReason | null {
  if (isLeadSuppressed(lead, suppressedEmails, suppressedDomains)) return "suppressed";
  if (isExpiredPersonalLead(lead, now, policy)) return "retention_expired";
  return null;
}
