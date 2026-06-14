// Pure parser for the EVNY (Egyéni Vállalkozók Nyilvántartása — sole-trader
// registry). Every record is a natural person, so each lead is asserted as
// personal data. Categorized from the TEÁOR activity code. No I/O.

import type { ParseContext, RawBusiness } from "../types.js";
import { teaorToCategories } from "./teaor.js";

export type EvnyRecord = {
  id?: string | number;
  name?: string | null; // személynév + e.v.
  registrationNumber?: string | null; // egyéni vállalkozói nyilvántartási szám
  taxNumber?: string | null;
  seat?: string | null;
  teaorCode?: string | null;
  teaorText?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
};

export type EvnyPage = { results?: EvnyRecord[] };

export function parseEvnyPage(page: EvnyPage, ctx: ParseContext): RawBusiness[] {
  const out: RawBusiness[] = [];
  for (const r of page.results ?? []) {
    const name = (r.name ?? "").trim();
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
      categories: r.teaorCode ? teaorToCategories([r.teaorCode]) : [],
      isPersonalData: true, // sole-trader registry — always personal data
      source: ctx.source,
      sourceUrl: r.id != null ? `${ctx.baseUrl}/ev/${r.id}` : ctx.baseUrl,
      sourceLicense: ctx.license,
    });
  }
  return out;
}
