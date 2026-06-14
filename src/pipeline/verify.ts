// VAT verification pipeline (enrichment). For each lead carrying a VAT number
// that has never been verified (or whose verification has gone stale), confirm
// the number and stamp `lastVerifiedAt` + `vatValid`, then re-score quality and
// leave a VERIFIED audit row.
//
// Two methods, mirroring the collect pipeline's fixture/--live split:
//   - offline (default): local HU check-digit validation (no network).
//   - --live: the EU VIES service (authoritative, terms-clean; docs/LEGAL.md).
//
// This is still collection/compliance work — it makes no contact. Verification
// raises data quality and is a prerequisite for any later (gated) outreach.

import { db } from "../db.js";
import { config } from "../config.js";
import { politePost } from "../lib/fetcher.js";
import { qualityScore } from "../lib/quality.js";
import { recordAudit } from "../lib/audit.js";
import { rowToLeadInput } from "../lib/leadRow.js";
import { isValidHuVat } from "../lib/normalize.js";
import { huVatCore, parseViesResult, viesRequestBody } from "../lib/vies.js";

export type VerifyOptions = {
  live: boolean;
  limit?: number;
  staleDays?: number;
};

export type VerifyStats = {
  method: "checksum" | "vies";
  checked: number;
  valid: number;
  invalid: number;
};

// One verification check → did the number validate?
async function checkVat(vatNumber: string, live: boolean): Promise<boolean> {
  if (!live) return isValidHuVat(vatNumber);

  const core = huVatCore(vatNumber);
  if (!core) return false;
  const body = JSON.stringify(viesRequestBody("HU", core));
  const json = JSON.parse(await politePost(config.viesUrl, body, "application/json"));
  return parseViesResult(json).valid;
}

export async function verify(opts: VerifyOptions): Promise<VerifyStats> {
  const staleBefore = new Date(
    Date.now() - (opts.staleDays ?? config.verifyTtlDays) * 24 * 60 * 60 * 1000,
  );

  // Leads with a VAT number that were never verified or are now stale.
  const candidates = await db.lead.findMany({
    where: {
      vatNumber: { not: null },
      OR: [{ lastVerifiedAt: null }, { lastVerifiedAt: { lt: staleBefore } }],
    },
    orderBy: { collectedAt: "asc" },
    take: opts.limit ?? 100,
  });

  const stats: VerifyStats = {
    method: opts.live ? "vies" : "checksum",
    checked: 0,
    valid: 0,
    invalid: 0,
  };

  for (const row of candidates) {
    if (!row.vatNumber) continue;
    const valid = await checkVat(row.vatNumber, opts.live);
    stats.checked++;
    valid ? stats.valid++ : stats.invalid++;

    await db.lead.update({
      where: { id: row.id },
      data: {
        vatValid: valid,
        lastVerifiedAt: new Date(),
        qualityScore: qualityScore(rowToLeadInput(row), valid),
      },
    });
    await recordAudit(row.id, "VERIFIED", {
      method: stats.method,
      vatNumber: row.vatNumber,
      valid,
    });
  }

  return stats;
}
