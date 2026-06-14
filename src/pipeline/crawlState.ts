// Resumable crawl cursors: where each (source, region) crawl reached, so a
// re-run continues from there instead of re-scanning from page 1.

import { db } from "../db.js";

// lastPage per region for a source (0 / absent = never crawled).
export async function getCursors(source: string, regionIds: string[]): Promise<Map<string, number>> {
  const rows = await db.crawlState.findMany({
    where: { source, regionId: { in: regionIds } },
    select: { regionId: true, lastPage: true },
  });
  return new Map(rows.map((r) => [r.regionId, r.lastPage]));
}

export async function saveCursor(
  source: string,
  regionId: string,
  lastPage: number,
  seen: number,
): Promise<void> {
  await db.crawlState.upsert({
    where: { source_regionId: { source, regionId } },
    update: { lastPage, lastRunAt: new Date(), totalSeen: { increment: seen } },
    create: { source, regionId, lastPage, totalSeen: seen },
  });
}
