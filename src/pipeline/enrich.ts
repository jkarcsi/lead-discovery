// Tier-2 contact enrichment. For leads that have a website domain but are
// missing an email or phone, fetch the contact page and fill the gaps (never
// overwriting existing values), recompute quality, and stamp `contactCheckedAt`.
// Default processes only un-checked leads; `revalidate` re-checks.

import { db } from "../db.js";
import { config } from "../config.js";
import { fetchContacts } from "../connectors/contactPage.js";
import { mapWithConcurrency } from "../lib/concurrency.js";
import { categorize } from "../lib/categorize.js";
import { qualityScore } from "../lib/quality.js";
import { leadInputFromRow } from "../lib/leadRow.js";
import { recordAudit } from "../lib/audit.js";

// Cap on the persisted classification text so appending website text doesn't
// bloat the row over repeated runs.
const CLASSIFICATION_MAX = 1200;

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
  categoriesAdded: number; // leads that gained a category from their website text
  skipped: number; // no contact page (offline: no fixture)
};

export async function enrichContacts(opts: EnrichOptions = {}): Promise<EnrichStats> {
  const now = opts.now ?? new Date();
  const live = opts.live ?? false;

  const leads = await db.lead.findMany({
    where: {
      domain: { not: null },
      ...(opts.revalidate ? {} : { contactCheckedAt: null }),
      // Visit a site if it can still fill a gap: a missing contact OR no category
      // yet. The latter lets a fully-contacted-but-uncategorized lead (common for
      // OSM POIs with a website) get categorized from its own page text.
      OR: [{ email: null }, { phone: null }, { categories: "[]" }],
    },
    ...(opts.limit ? { take: opts.limit } : {}),
  });

  const stats: EnrichStats = {
    scanned: 0, enriched: 0, emailsAdded: 0, phonesAdded: 0, categoriesAdded: 0, skipped: 0,
  };
  const total = leads.length;
  const startedAt = Date.now();

  // Fetch is the slow, network-bound part; a dead/slow site can take several
  // seconds. A *continuous* worker pool keeps all workers saturated so one slow
  // site doesn't block the others (fixed-size windows stalled on their slowest
  // member). DB writes are serialized through a tiny mutex because SQLite is
  // single-writer, while fetches keep running concurrently.
  let writeChain: Promise<unknown> = Promise.resolve();
  const serialize = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = writeChain.then(fn, fn);
    writeChain = run.then(undefined, () => undefined);
    return run;
  };

  await mapWithConcurrency(leads, Math.max(1, config.fetchConcurrency), async (lead) => {
    const contacts = await fetchContacts(lead.domain as string, { live });
    await serialize(async () => {
      stats.scanned++;
      if (contacts) {
        const patch: { email?: string; phone?: string } = {};
        if (!lead.email && contacts.emails[0]) patch.email = contacts.emails[0];
        if (!lead.phone && contacts.phones[0]) patch.phone = contacts.phones[0];
        const contactChanged = patch.email !== undefined || patch.phone !== undefined;

        // Re-categorize from what the website says it does — the free signal the
        // thin OSM tags / name often lack. Append the page text to the stored
        // classification text and union any new categories onto the existing.
        const prevText = lead.classificationText ?? "";
        let classText = prevText;
        if (contacts.text && !prevText.includes(contacts.text)) {
          classText = `${prevText} ${contacts.text}`.trim().slice(0, CLASSIFICATION_MAX);
        }
        const prevCats = JSON.parse(lead.categories) as string[];
        const nextCats = Array.from(new Set([...prevCats, ...categorize(classText)]));
        const gainedCat = nextCats.length > prevCats.length;

        const changed = contactChanged || gainedCat || classText !== prevText;
        const data: Record<string, unknown> = { contactCheckedAt: now, ...patch };
        if (classText !== prevText) data.classificationText = classText;
        if (gainedCat) data.categories = JSON.stringify(nextCats);
        if (contactChanged || gainedCat) {
          if (patch.email) stats.emailsAdded++;
          if (patch.phone) stats.phonesAdded++;
          if (gainedCat) stats.categoriesAdded++;
          data.qualityScore = qualityScore({ ...leadInputFromRow(lead), ...patch, categories: nextCats });
        }

        await db.lead.update({ where: { id: lead.id }, data });
        if (contactChanged || gainedCat) {
          if (contactChanged) stats.enriched++;
          await recordAudit(lead.id, "ENRICHED", {
            source: "contact-page",
            ...patch,
            ...(gainedCat ? { categories: nextCats } : {}),
          });
        }
      } else {
        stats.skipped++;
      }
      opts.onProgress?.({ ...stats, total, elapsedMs: Date.now() - startedAt });
    });
  });

  return stats;
}
