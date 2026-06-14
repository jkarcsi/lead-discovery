// Pure parser for a generic JSON business-directory page (no I/O). Many public
// directories / open-data portals expose paginated JSON like
// `{ "results": [ { name, email, phone, website, address, vat, activity } ] }`.
// This maps one page into RawBusiness records; the connector handles fetching
// and pagination.

import type { ParseContext, RawBusiness } from "../types.js";

export type DirectoryRecord = {
  id?: string | number;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
  vat?: string | null;
  activity?: string | null;
};

export type DirectoryPage = { results?: DirectoryRecord[] };

export function parseDirectoryPage(page: DirectoryPage, ctx: ParseContext): RawBusiness[] {
  const out: RawBusiness[] = [];
  for (const r of page.results ?? []) {
    const name = (r.name ?? "").trim();
    if (!name) continue; // a listing with no name is useless as a lead
    out.push({
      legalName: name,
      brandName: null,
      email: r.email ?? null,
      phone: r.phone ?? null,
      website: r.website ?? null,
      address: r.address ?? null,
      vatNumber: r.vat ?? null,
      registrationNumber: null,
      classificationText: `${r.activity ?? ""} ${name}`.trim(),
      source: ctx.source,
      sourceUrl: r.id != null ? `${ctx.baseUrl}/biz/${r.id}` : ctx.baseUrl,
      sourceLicense: ctx.license,
    });
  }
  return out;
}
