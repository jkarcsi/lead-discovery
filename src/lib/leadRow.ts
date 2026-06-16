// Map a stored Lead row back into a LeadInput. Shared by the pipeline steps that
// need to re-derive (merge on re-collection, re-score on enrichment) so the
// row→input mapping lives in exactly one place. Pure (categories is the only
// JSON-encoded column).

import type { LeadInput } from "../types.js";

// The Lead columns a LeadInput is built from; a Prisma Lead row satisfies this.
export type LeadRow = {
  legalName: string;
  brandName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  domain: string | null;
  address: string | null;
  vatNumber: string | null;
  registrationNumber: string | null;
  regionId: string | null;
  categories: string; // JSON array of category ids
  classificationText: string | null;
  source: string;
  sourceUrl: string | null;
  sourceLicense: string | null;
  isPersonalData: boolean;
};

export function leadInputFromRow(row: LeadRow): LeadInput {
  return {
    legalName: row.legalName,
    brandName: row.brandName,
    email: row.email,
    phone: row.phone,
    website: row.website,
    domain: row.domain,
    address: row.address,
    vatNumber: row.vatNumber,
    registrationNumber: row.registrationNumber,
    regionId: row.regionId,
    categories: JSON.parse(row.categories) as string[],
    classificationText: row.classificationText,
    source: row.source,
    sourceUrl: row.sourceUrl,
    sourceLicense: row.sourceLicense,
    isPersonalData: row.isPersonalData,
  };
}
