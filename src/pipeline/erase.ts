// Shared lead-erasure primitive. Deletes a lead and leaves a DETACHED audit row
// (leadId = null, so it survives the lead's cascade delete) whose meta carries
// no personal data — only the pseudonymous lead id, source, region, and the
// caller's reason fields. Used by both retention purge and DSAR erasure so the
// "erase + accountable record" contract lives in exactly one place.

import { db } from "../db.js";
import { recordAudit, type AuditType } from "../lib/audit.js";

export async function eraseLead(
  lead: { id: string; source: string; regionId: string | null },
  type: AuditType,
  meta: Record<string, unknown> = {},
): Promise<void> {
  await recordAudit(null, type, {
    leadId: lead.id,
    source: lead.source,
    regionId: lead.regionId,
    ...meta,
  });
  await db.lead.delete({ where: { id: lead.id } });
}
