// Manual review queue / admin surface. Lists PENDING leads (prioritized) for an
// operator to vet, and records APPROVE/REJECT decisions with an audit trail.
// Review status is orthogonal to lifecycle: it gates whether a lead is ever
// considered for the (separately gated) outreach phase.

import { db } from "../db.js";
import { recordAudit } from "../lib/audit.js";
import { leadInputFromRow } from "../lib/leadRow.js";
import { decisionToStatus, queueComparator, reviewReasons } from "../lib/review.js";

export type QueueOptions = {
  regionId?: string;
  category?: string;
  limit?: number;
};

export type QueueItem = {
  id: string;
  legalName: string;
  regionId: string | null;
  categories: string[];
  qualityScore: number;
  isPersonalData: boolean;
  contact: string | null;
  reasons: string[];
};

export async function reviewQueue(opts: QueueOptions = {}): Promise<QueueItem[]> {
  const rows = await db.lead.findMany({
    where: {
      reviewStatus: "PENDING",
      ...(opts.regionId ? { regionId: opts.regionId } : {}),
    },
  });

  const items = rows
    .map((row) => {
      const lead = leadInputFromRow(row);
      return {
        id: row.id,
        legalName: row.legalName,
        regionId: row.regionId,
        categories: lead.categories,
        qualityScore: row.qualityScore,
        isPersonalData: row.isPersonalData,
        contact: row.email ?? row.phone ?? null,
        reasons: reviewReasons({
          email: row.email,
          phone: row.phone,
          categories: lead.categories,
          qualityScore: row.qualityScore,
          isPersonalData: row.isPersonalData,
        }),
      };
    })
    .filter((it) => (opts.category ? it.categories.includes(opts.category) : true))
    .sort(queueComparator);

  return typeof opts.limit === "number" ? items.slice(0, opts.limit) : items;
}

export type ReviewResult = { id: string; legalName: string; status: string };

// Apply an approve/reject decision to a lead. Throws if the lead doesn't exist
// so the operator gets a clear error rather than a silent no-op.
export async function setReview(
  leadId: string,
  action: string,
  note?: string,
): Promise<ReviewResult> {
  const status = decisionToStatus(action);
  const lead = await db.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new Error(`No lead with id "${leadId}"`);

  await db.lead.update({
    where: { id: leadId },
    data: { reviewStatus: status, reviewNote: note ?? null, reviewedAt: new Date() },
  });
  await recordAudit(leadId, "REVIEWED", { status, ...(note ? { note } : {}) });

  return { id: leadId, legalName: lead.legalName, status };
}
