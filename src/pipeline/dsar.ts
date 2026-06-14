// DSAR operations: the data-subject rights the legal design requires before any
// (see docs/SCOPE.md). A subject is identified by their (normalized) email.
//
//   export — Art. 15 access / Art. 20 portability: a full copy of what we hold.
//   erase  — Art. 17 erasure + Art. 21 objection: delete the subject's leads and
//            add a permanent suppression so re-collection can't resurrect them.
//
// Only the exact email is suppressed (never the whole domain) — one person
// objecting must not block their employer's general business contact.

import { db } from "../db.js";
import { normalizeEmail } from "../lib/normalize.js";
import { buildDsarReport, type DsarReport } from "../lib/dsar.js";
import { addSuppression } from "../lib/suppression.js";
import { recordAudit } from "../lib/audit.js";
import { eraseLead } from "./erase.js";

function requireEmail(raw: string): string {
  const email = normalizeEmail(raw);
  if (!email) throw new Error(`Not a valid email: "${raw}"`);
  return email;
}

export async function dsarExport(rawEmail: string, now: Date = new Date()): Promise<DsarReport> {
  const email = requireEmail(rawEmail);
  const leads = await db.lead.findMany({
    where: { email },
    include: { auditEvents: { orderBy: { createdAt: "asc" } } },
  });
  // Log that an access request was fulfilled (leads still exist to attach to).
  for (const l of leads) await recordAudit(l.id, "DSAR", { action: "export" });
  return buildDsarReport(email, leads, now);
}

export type DsarEraseResult = { subject: string; erased: number };

export async function dsarErase(rawEmail: string): Promise<DsarEraseResult> {
  const email = requireEmail(rawEmail);
  const leads = await db.lead.findMany({ where: { email } });
  for (const lead of leads) await eraseLead(lead, "DSAR", { action: "erasure" });
  await addSuppression(email, "EMAIL", "DSAR erasure / objection");
  return { subject: email, erased: leads.length };
}
