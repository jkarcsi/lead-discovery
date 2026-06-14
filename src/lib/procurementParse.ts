// Pure parser for a public-procurement award page (Közbeszerzési Értesítő / EKR
// / TED style). Each award names a winning supplier — proof of an active
// supplier — and CPV codes describing the subject, which we map to taxonomy
// categories. No I/O.

import type { ParseContext, RawBusiness } from "../types.js";
import { cpvToCategories } from "./cpv.js";

export type ProcurementRecord = {
  id?: string | number;
  supplierName?: string | null;
  supplierVat?: string | null;
  supplierAddress?: string | null;
  cpvCodes?: string[];
  title?: string | null;
};

export type ProcurementPage = { results?: ProcurementRecord[] };

export function parseProcurementPage(page: ProcurementPage, ctx: ParseContext): RawBusiness[] {
  const out: RawBusiness[] = [];
  for (const r of page.results ?? []) {
    const name = (r.supplierName ?? "").trim();
    if (!name) continue;
    out.push({
      legalName: name,
      brandName: null,
      email: null,
      phone: null,
      website: null,
      address: r.supplierAddress ?? null,
      vatNumber: r.supplierVat ?? null,
      registrationNumber: null,
      classificationText: `${r.title ?? ""} ${name}`.trim(),
      categories: cpvToCategories(r.cpvCodes ?? []),
      source: ctx.source,
      sourceUrl: r.id != null ? `${ctx.baseUrl}/eljaras/${r.id}` : ctx.baseUrl,
      sourceLicense: ctx.license,
    });
  }
  return out;
}
