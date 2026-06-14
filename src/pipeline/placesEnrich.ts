// Google Places enrichment. For leads missing a phone or website, look the
// business up in Places and fill the gaps (phone / website / address), deriving
// the domain from the website. Recomputes quality, stamps `placesCheckedAt`.

import { db } from "../db.js";
import { lookupPlace } from "../connectors/places.js";
import { qualityScore } from "../lib/quality.js";
import { leadInputFromRow } from "../lib/leadRow.js";
import { domainFromUrl } from "../lib/normalize.js";
import { recordAudit } from "../lib/audit.js";

export type PlacesOptions = { live?: boolean; limit?: number; revalidate?: boolean; now?: Date };

export type PlacesStats = {
  scanned: number;
  enriched: number;
  phonesAdded: number;
  websitesAdded: number;
  addressesAdded: number;
  skipped: number;
};

export async function placesEnrich(opts: PlacesOptions = {}): Promise<PlacesStats> {
  const now = opts.now ?? new Date();
  const live = opts.live ?? false;

  const leads = await db.lead.findMany({
    where: {
      ...(opts.revalidate ? {} : { placesCheckedAt: null }),
      OR: [{ phone: null }, { website: null }],
    },
    ...(opts.limit ? { take: opts.limit } : {}),
  });

  const stats: PlacesStats = {
    scanned: 0,
    enriched: 0,
    phonesAdded: 0,
    websitesAdded: 0,
    addressesAdded: 0,
    skipped: 0,
  };

  for (const lead of leads) {
    stats.scanned++;
    const place = await lookupPlace(lead.legalName, lead.regionId, { live });
    if (!place) {
      stats.skipped++;
      continue;
    }

    const patch: { phone?: string; website?: string; domain?: string; address?: string } = {};
    if (!lead.phone && place.phone) patch.phone = place.phone;
    if (!lead.website && place.website) {
      patch.website = place.website;
      patch.domain = domainFromUrl(place.website) ?? undefined;
    }
    if (!lead.address && place.address) patch.address = place.address;

    const changed = Object.keys(patch).length > 0;
    const data: Record<string, unknown> = { placesCheckedAt: now, ...patch };
    if (changed) {
      if (patch.phone) stats.phonesAdded++;
      if (patch.website) stats.websitesAdded++;
      if (patch.address) stats.addressesAdded++;
      data.qualityScore = qualityScore({ ...leadInputFromRow(lead), ...patch });
    }

    await db.lead.update({ where: { id: lead.id }, data });
    if (changed) {
      stats.enriched++;
      await recordAudit(lead.id, "ENRICHED", { source: "places" });
    }
  }

  return stats;
}
