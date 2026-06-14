// VAT verification / enrichment step. For each stored lead carrying a HU VAT
// number, ask EU VIES whether it's registered; stamp `lastVerifiedAt`, fill a
// missing address from the authoritative response, and leave a `VERIFIED` audit
// row. No outreach — this is collection-side enrichment (see docs/LEGAL.md).
//
// By default only unverified leads (`lastVerifiedAt == null`) are checked;
// `revalidate` re-checks everything (e.g. a periodic re-verification sweep).

import { db } from "../db.js";
import { checkVat } from "../connectors/vies.js";
import { verificationPatch } from "../lib/vies.js";
import { leadInputFromRow } from "../lib/leadRow.js";
import { qualityScore } from "../lib/quality.js";
import { recordAudit } from "../lib/audit.js";

export type VerifyOptions = {
  live?: boolean;
  limit?: number;
  revalidate?: boolean;
  now?: Date;
};

export type VerifyStats = {
  scanned: number;
  valid: number;
  invalid: number;
  enriched: number;
  skipped: number; // no VIES answer (offline: no fixture; or unparseable VAT)
};

export async function verify(opts: VerifyOptions = {}): Promise<VerifyStats> {
  const now = opts.now ?? new Date();
  const live = opts.live ?? false;

  const leads = await db.lead.findMany({
    where: {
      vatNumber: { not: null },
      ...(opts.revalidate ? {} : { lastVerifiedAt: null }),
    },
    ...(opts.limit ? { take: opts.limit } : {}),
  });

  const stats: VerifyStats = { scanned: 0, valid: 0, invalid: 0, enriched: 0, skipped: 0 };

  for (const lead of leads) {
    stats.scanned++;
    const result = await checkVat(lead.vatNumber, { live });
    if (!result) {
      stats.skipped++;
      continue;
    }

    if (!result.valid) {
      stats.invalid++;
      await db.lead.update({ where: { id: lead.id }, data: { lastVerifiedAt: now } });
      await recordAudit(lead.id, "VERIFIED", { source: "vies", valid: false });
      continue;
    }

    stats.valid++;
    const patch = verificationPatch(lead, result);
    const data: Record<string, unknown> = { lastVerifiedAt: now, ...patch };
    if (patch.address) {
      stats.enriched++;
      data.qualityScore = qualityScore({ ...leadInputFromRow(lead), address: patch.address });
    }
    await db.lead.update({ where: { id: lead.id }, data });
    await recordAudit(lead.id, "VERIFIED", { source: "vies", valid: true });
  }

  return stats;
}
