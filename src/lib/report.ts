// Pure coverage/throughput report assembly (no I/O). The CLI normalizes DB rows
// into ReportLead and renders the returned structure.

export type ReportLead = {
  source: string;
  categories: string[];
  qualityScore: number;
  hasEmail: boolean;
  isPersonalData: boolean;
  viesVerified: boolean;
  navChecked: boolean;
  contactChecked: boolean;
  placesChecked: boolean;
  reviewStatus: string;
};

export type CoverageReport = {
  total: number;
  withEmail: number;
  personalData: number;
  bySource: [string, number][]; // sorted by count desc
  review: { pending: number; approved: number; rejected: number };
  enrichment: { viesVerified: number; navChecked: number; contactChecked: number; placesChecked: number };
  quality: { high: number; medium: number; low: number }; // 70+, 40–69, <40
};

export function buildCoverageReport(leads: ReportLead[]): CoverageReport {
  const bySource = new Map<string, number>();
  const review = { pending: 0, approved: 0, rejected: 0 };
  const enrichment = { viesVerified: 0, navChecked: 0, contactChecked: 0, placesChecked: 0 };
  const quality = { high: 0, medium: 0, low: 0 };
  let withEmail = 0;
  let personalData = 0;

  for (const l of leads) {
    bySource.set(l.source, (bySource.get(l.source) ?? 0) + 1);
    if (l.hasEmail) withEmail++;
    if (l.isPersonalData) personalData++;
    if (l.viesVerified) enrichment.viesVerified++;
    if (l.navChecked) enrichment.navChecked++;
    if (l.contactChecked) enrichment.contactChecked++;
    if (l.placesChecked) enrichment.placesChecked++;
    if (l.reviewStatus === "APPROVED") review.approved++;
    else if (l.reviewStatus === "REJECTED") review.rejected++;
    else review.pending++;
    if (l.qualityScore >= 70) quality.high++;
    else if (l.qualityScore >= 40) quality.medium++;
    else quality.low++;
  }

  return {
    total: leads.length,
    withEmail,
    personalData,
    bySource: [...bySource.entries()].sort((a, b) => b[1] - a[1]),
    review,
    enrichment,
    quality,
  };
}
