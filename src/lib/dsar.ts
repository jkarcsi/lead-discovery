// Pure assembly of a Data Subject Access Request (DSAR) report — the "access"
// right (GDPR Art. 15): everything we hold about a subject, plus the provenance
// and the accountability trail. No I/O; the DB lookups live in
// `pipeline/dsar.ts`. Dates are serialized to ISO and the categories JSON column
// is parsed, so the result is a clean, portable record (Art. 20 portability).

export type DsarAuditView = {
  type: string;
  meta: string | null;
  createdAt: string;
};

export type DsarLeadRecord = {
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
  categories: string[];
  isPersonalData: boolean;
  gdprBasis: string;
  qualityScore: number;
  lifecycle: string;
  source: string;
  sourceUrl: string | null;
  sourceLicense: string | null;
  collectedAt: string;
  lastVerifiedAt: string | null;
  auditTrail: DsarAuditView[];
};

export type DsarReport = {
  subject: string;
  generatedAt: string;
  leadCount: number;
  records: DsarLeadRecord[];
};

// Shape this builder consumes — a Prisma Lead row with its auditEvents included.
export type DsarLeadInput = {
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
  isPersonalData: boolean;
  gdprBasis: string;
  qualityScore: number;
  lifecycle: string;
  source: string;
  sourceUrl: string | null;
  sourceLicense: string | null;
  collectedAt: Date;
  lastVerifiedAt: Date | null;
  auditEvents: { type: string; meta: string | null; createdAt: Date }[];
};

export function buildDsarReport(
  subject: string,
  leads: DsarLeadInput[],
  now: Date,
): DsarReport {
  return {
    subject,
    generatedAt: now.toISOString(),
    leadCount: leads.length,
    records: leads.map((l) => ({
      legalName: l.legalName,
      brandName: l.brandName,
      email: l.email,
      phone: l.phone,
      website: l.website,
      domain: l.domain,
      address: l.address,
      vatNumber: l.vatNumber,
      registrationNumber: l.registrationNumber,
      regionId: l.regionId,
      categories: JSON.parse(l.categories) as string[],
      isPersonalData: l.isPersonalData,
      gdprBasis: l.gdprBasis,
      qualityScore: l.qualityScore,
      lifecycle: l.lifecycle,
      source: l.source,
      sourceUrl: l.sourceUrl,
      sourceLicense: l.sourceLicense,
      collectedAt: l.collectedAt.toISOString(),
      lastVerifiedAt: l.lastVerifiedAt ? l.lastVerifiedAt.toISOString() : null,
      auditTrail: l.auditEvents.map((e) => ({
        type: e.type,
        meta: e.meta,
        createdAt: e.createdAt.toISOString(),
      })),
    })),
  };
}
