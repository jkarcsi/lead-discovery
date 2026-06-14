// Accountability trail (GDPR Art. 5(2)/30): every meaningful action on a lead
// leaves a row. `meta` is free-form JSON serialized to a string (SQLite).

import { db } from "../db.js";

export type AuditType =
  | "COLLECTED"
  | "MERGED"
  | "CONTACTED"
  | "OPT_OUT"
  | "DSAR"
  | "VERIFIED"
  | "NAV_CHECKED"
  | "ENRICHED"
  | "REGISTERED"
  | "SUPPRESSED_SKIP"
  | "REVIEWED"
  | "PURGED";

export async function recordAudit(
  leadId: string | null,
  type: AuditType,
  meta?: Record<string, unknown>,
): Promise<void> {
  await db.auditEvent.create({
    data: {
      leadId,
      type,
      meta: meta ? JSON.stringify(meta) : null,
    },
  });
}
