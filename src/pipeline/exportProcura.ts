// Export leads to an NDJSON file for Procura matching. Excludes rejected leads
// and (by default) personal data; filters by minimum quality. The pure mapping
// is in lib/procuraExport.ts.

import { writeFileSync } from "node:fs";
import { db } from "../db.js";
import { toProcuraRecord } from "../lib/procuraExport.js";

export type ExportOptions = {
  out: string;
  minQuality?: number;
  approvedOnly?: boolean;
  includePersonal?: boolean;
};

export type ExportStats = { exported: number; out: string };

export async function exportProcura(opts: ExportOptions): Promise<ExportStats> {
  const leads = await db.lead.findMany({
    where: {
      qualityScore: { gte: opts.minQuality ?? 0 },
      reviewStatus: opts.approvedOnly ? "APPROVED" : { not: "REJECTED" },
      ...(opts.includePersonal ? {} : { isPersonalData: false }),
    },
    orderBy: { qualityScore: "desc" },
  });

  const ndjson = leads.map((l) => JSON.stringify(toProcuraRecord(l))).join("\n");
  writeFileSync(opts.out, ndjson ? ndjson + "\n" : "");

  return { exported: leads.length, out: opts.out };
}
