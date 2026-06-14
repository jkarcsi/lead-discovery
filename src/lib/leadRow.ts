// Reconstruct a LeadInput from a stored Lead row (pure). Shared by the ingest
// pipeline (to merge into an existing lead) and the verify pipeline (to
// re-score a lead after VAT verification).

import type { LeadInput } from "../types.js";

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
  categories: string;
  source: string;
  sourceUrl: string | null;
  sourceLicense: string | null;
  isPersonalData: boolean;
};

export function rowToLeadInput(row: LeadRow): LeadInput {
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
    source: row.source,
    sourceUrl: row.sourceUrl,
    sourceLicense: row.sourceLicense,
    isPersonalData: row.isPersonalData,
  };
}
