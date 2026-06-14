// Pure parser for a company-registry page (e-beszámoló / Céginformációs
// Szolgálat — public company master data). Unlike a plain directory, registry
// records carry the registration number (cégjegyzékszám) and a TEÁOR activity
// code, so they enrich existing leads (matched by VAT) with authoritative
// company identity. No I/O.

import type { ParseContext, RawBusiness } from "../types.js";

export type CompanyRecord = {
  id?: string | number;
  companyName?: string | null; // cégnév
  taxNumber?: string | null; // adószám
  registrationNumber?: string | null; // cégjegyzékszám
  seat?: string | null; // székhely
  teaorCode?: string | null;
  teaorText?: string | null;
  website?: string | null;
  email?: string | null;
  phone?: string | null;
};

export type CompanyRegistryPage = { results?: CompanyRecord[] };

export function parseCompanyRegistryPage(
  page: CompanyRegistryPage,
  ctx: ParseContext,
): RawBusiness[] {
  const out: RawBusiness[] = [];
  for (const r of page.results ?? []) {
    const name = (r.companyName ?? "").trim();
    if (!name) continue;
    out.push({
      legalName: name,
      brandName: null,
      email: r.email ?? null,
      phone: r.phone ?? null,
      website: r.website ?? null,
      address: r.seat ?? null,
      vatNumber: r.taxNumber ?? null,
      registrationNumber: r.registrationNumber ?? null,
      classificationText: `${r.teaorText ?? ""} ${name}`.trim(),
      source: ctx.source,
      sourceUrl: r.id != null ? `${ctx.baseUrl}/cegadat/${r.id}` : ctx.baseUrl,
      sourceLicense: ctx.license,
    });
  }
  return out;
}
