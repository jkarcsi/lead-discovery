// Pure helpers for the manual review queue (no I/O). Human vetting sits between
// collection and any future (gated) outreach: an operator approves the
// high-value, clearly-business leads and rejects or holds the rest. The DB-side
// queue/transition lives in `pipeline/review.ts`.

export const REVIEW_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

// Map an operator action word to the target status. Throws on anything else so
// the CLI fails loudly rather than silently mis-setting state.
export function decisionToStatus(action: string): ReviewStatus {
  if (action === "approve") return "APPROVED";
  if (action === "reject") return "REJECTED";
  throw new Error(`Unknown review action "${action}". Use "approve" or "reject".`);
}

export const LOW_QUALITY_THRESHOLD = 40;

export type ReviewLeadView = {
  email: string | null;
  phone: string | null;
  categories: string[];
  qualityScore: number;
  isPersonalData: boolean;
};

// Why a lead needs a careful look. An empty list means a clean, ready-to-approve
// business lead. Order is by how much it should give the operator pause.
export function reviewReasons(lead: ReviewLeadView): string[] {
  const reasons: string[] = [];
  if (lead.isPersonalData) {
    reasons.push("personal data — handle conservatively, likely exclude from early outreach");
  }
  if (!lead.email && !lead.phone) reasons.push("no contact channel");
  if (lead.categories.length === 0) reasons.push("uncategorized");
  if (lead.qualityScore < LOW_QUALITY_THRESHOLD) {
    reasons.push(`low quality (<${LOW_QUALITY_THRESHOLD})`);
  }
  return reasons;
}

// Queue ordering: highest quality first, with personal-data leads grouped after
// equal-quality company leads (the operator clears clean business leads fast,
// then gives the sensitive ones deliberate attention). Stable, total order.
// Typed to just the fields it needs so any lead-shaped row can be sorted.
type Ordered = { isPersonalData: boolean; qualityScore: number };
export function queueComparator(a: Ordered, b: Ordered): number {
  if (a.isPersonalData !== b.isPersonalData) return a.isPersonalData ? 1 : -1;
  return b.qualityScore - a.qualityScore;
}
