// Tier-2 contact enrichment. For leads that have a website domain but are
// missing an email or phone, fetch the contact page and fill the gaps (never
// overwriting existing values), recompute quality, and stamp `contactCheckedAt`.
// Default processes only un-checked leads; `revalidate` re-checks.

import { db } from "../db.js";
import { fetchContacts } from "../connectors/contactPage.js";
import { qualityScore } from "../lib/quality.js";
import { leadInputFromRow } from "../lib/leadRow.js";
import { recordAudit } from "../lib/audit.js";

export type EnrichOptions = { live?: boolean; limit?: number; revalidate?: boolean; now?: Date };

export type EnrichStats = {
  scanned: number;
  enriched: number;
  emailsAdded: number;
  phonesAdded: number;
  skipped: number; // no contact page (offline: no fixture)
};

export async function enrichContacts(opts: EnrichOptions = {}): Promise<EnrichStats> {
  const now = opts.now ?? new Date();
  const live = opts.live ?? false;

  const leads = await db.lead.findMany({
    where: {
      domain: { not: null },
      ...(opts.revalidate ? {} : { contactCheckedAt: null }),
      OR: [{ email: null }, { phone: null }],
    },
    ...(opts.limit ? { take: opts.limit } : {}),
  });

  const stats: EnrichStats = { scanned: 0, enriched: 0, emailsAdded: 0, phonesAdded: 0, skipped: 0 };

  for (const lead of leads) {
    stats.scanned++;
    const contacts = await fetchContacts(lead.domain as string, { live });
    if (!contacts) {
      stats.skipped++;
      continue;
    }

    const patch: { email?: string; phone?: string } = {};
    if (!lead.email && contacts.emails[0]) patch.email = contacts.emails[0];
    if (!lead.phone && contacts.phones[0]) patch.phone = contacts.phones[0];

    const changed = patch.email !== undefined || patch.phone !== undefined;
    const data: Record<string, unknown> = { contactCheckedAt: now, ...patch };
    if (changed) {
      if (patch.email) stats.emailsAdded++;
      if (patch.phone) stats.phonesAdded++;
      data.qualityScore = qualityScore({ ...leadInputFromRow(lead), ...patch });
    }

    await db.lead.update({ where: { id: lead.id }, data });
    if (changed) {
      stats.enriched++;
      await recordAudit(lead.id, "ENRICHED", { source: "contact-page", ...patch });
    }
  }

  return stats;
}
