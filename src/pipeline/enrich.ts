// Tier-2 contact enrichment. For leads that have a website domain but are
// missing an email or phone, fetch the contact page and fill the gaps (never
// overwriting existing values), recompute quality, and stamp `contactCheckedAt`.
// Default processes only un-checked leads; `revalidate` re-checks.

import { db } from "../db.js";
import { config } from "../config.js";
import { fetchContacts } from "../connectors/contactPage.js";
import { mapWithConcurrency } from "../lib/concurrency.js";
import { qualityScore } from "../lib/quality.js";
import { leadInputFromRow } from "../lib/leadRow.js";
import { recordAudit } from "../lib/audit.js";

export type EnrichOptions = {
  live?: boolean;
  limit?: number;
  revalidate?: boolean;
  now?: Date;
  // Called after each lead with running totals so a caller (the CLI) can show
  // progress on a long live run. Omitted (e.g. in tests) means no logging.
  onProgress?: (p: EnrichProgress) => void;
};

export type EnrichProgress = EnrichStats & { total: number; elapsedMs: number };

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
  const total = leads.length;
  const startedAt = Date.now();

  // Fetch is the slow, network-bound part (each lead is a different host, so the
  // per-host throttle doesn't serialize them) — run it in concurrent windows.
  // DB writes stay sequential because SQLite is single-writer. We process one
  // window at a time so progress (and writes) are incremental, not all-at-end.
  const window = Math.max(1, config.fetchConcurrency);
  for (let i = 0; i < leads.length; i += window) {
    const batch = leads.slice(i, i + window);
    const fetched = await mapWithConcurrency(batch, window, async (lead) => ({
      lead,
      contacts: await fetchContacts(lead.domain as string, { live }),
    }));

    for (const { lead, contacts } of fetched) {
      stats.scanned++;
      if (contacts) {
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
      } else {
        stats.skipped++;
      }

      opts.onProgress?.({ ...stats, total, elapsedMs: Date.now() - startedAt });
    }
  }

  return stats;
}
