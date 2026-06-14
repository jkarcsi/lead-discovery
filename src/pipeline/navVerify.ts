// NAV enrichment step. For each lead carrying a HU VAT number, look up the tax
// authority signals (status / debt-free / headcount), write them onto the lead,
// stamp `navCheckedAt`, and record a `NAV_CHECKED` audit. Collection-side
// enrichment (see docs/SCOPE.md). Default checks only unchecked leads;
// `revalidate` re-checks everything.

import { db } from "../db.js";
import { checkTaxNumber } from "../connectors/nav.js";
import { recordAudit } from "../lib/audit.js";

export type NavVerifyOptions = {
  live?: boolean;
  limit?: number;
  revalidate?: boolean;
  now?: Date;
};

export type NavVerifyStats = {
  scanned: number;
  checked: number;
  active: number;
  suspended: number;
  cancelled: number;
  debtFree: number;
  skipped: number; // no NAV answer (offline: no fixture; or unparseable VAT)
};

export async function navVerify(opts: NavVerifyOptions = {}): Promise<NavVerifyStats> {
  const now = opts.now ?? new Date();
  const live = opts.live ?? false;

  const leads = await db.lead.findMany({
    where: {
      vatNumber: { not: null },
      ...(opts.revalidate ? {} : { navCheckedAt: null }),
    },
    ...(opts.limit ? { take: opts.limit } : {}),
  });

  const stats: NavVerifyStats = {
    scanned: 0,
    checked: 0,
    active: 0,
    suspended: 0,
    cancelled: 0,
    debtFree: 0,
    skipped: 0,
  };

  for (const lead of leads) {
    stats.scanned++;
    const signals = await checkTaxNumber(lead.vatNumber, { live });
    if (!signals) {
      stats.skipped++;
      continue;
    }

    stats.checked++;
    if (signals.taxStatus === "ACTIVE") stats.active++;
    else if (signals.taxStatus === "SUSPENDED") stats.suspended++;
    else if (signals.taxStatus === "CANCELLED") stats.cancelled++;
    if (signals.debtFree === true) stats.debtFree++;

    await db.lead.update({
      where: { id: lead.id },
      data: {
        taxStatus: signals.taxStatus,
        debtFree: signals.debtFree,
        employeeCount: signals.employeeCount,
        navCheckedAt: now,
      },
    });
    await recordAudit(lead.id, "NAV_CHECKED", {
      taxStatus: signals.taxStatus,
      debtFree: signals.debtFree,
    });
  }

  return stats;
}
