// Pure mapping of a stored lead → the record shape exported to Procura for
// matching (no I/O). NDJSON-friendly; categories are parsed from the JSON column.

export type ExportLeadRow = {
  id: string;
  legalName: string;
  vatNumber: string | null;
  registrationNumber: string | null;
  regionId: string | null;
  categories: string; // JSON array
  email: string | null;
  phone: string | null;
  website: string | null;
  qualityScore: number;
  taxStatus: string | null;
  debtFree: boolean | null;
  source: string;
};

export type ProcuraRecord = {
  externalId: string;
  legalName: string;
  vatNumber: string | null;
  registrationNumber: string | null;
  regionId: string | null;
  categories: string[];
  email: string | null;
  phone: string | null;
  website: string | null;
  qualityScore: number;
  taxStatus: string | null;
  debtFree: boolean | null;
  source: string;
};

export function toProcuraRecord(row: ExportLeadRow): ProcuraRecord {
  return {
    externalId: row.id,
    legalName: row.legalName,
    vatNumber: row.vatNumber,
    registrationNumber: row.registrationNumber,
    regionId: row.regionId,
    categories: JSON.parse(row.categories) as string[],
    email: row.email,
    phone: row.phone,
    website: row.website,
    qualityScore: row.qualityScore,
    taxStatus: row.taxStatus,
    debtFree: row.debtFree,
    source: row.source,
  };
}
