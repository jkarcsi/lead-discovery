// Pure ingest planner (no I/O). Collapses a raw batch into one entry per dedupe
// identity — merging duplicates *in memory* before any DB work — and drops
// suppressed leads up front. This is what lets the store layer hit the database
// in a few bulk queries instead of one round-trip per record.

import { dedupeKey, mergeLead } from "./dedupe.js";
import { isLeadSuppressed } from "./suppressionMatch.js";
import type { LeadInput } from "../types.js";

export type IngestPlanItem = {
  key: string;
  lead: LeadInput; // within-batch merged
  inputCount: number; // how many raw records collapsed into this identity
};

export type IngestPlan = {
  items: IngestPlanItem[];
  suppressedCount: number;
};

export function planIngest(leads: LeadInput[], suppressed: Set<string>): IngestPlan {
  const byKey = new Map<string, IngestPlanItem>();
  let suppressedCount = 0;

  for (const lead of leads) {
    if (isLeadSuppressed(lead, suppressed)) {
      suppressedCount++;
      continue;
    }
    const key = dedupeKey(lead);
    const existing = byKey.get(key);
    if (existing) {
      existing.lead = mergeLead(existing.lead, lead);
      existing.inputCount++;
    } else {
      byKey.set(key, { key, lead, inputCount: 1 });
    }
  }

  return { items: [...byKey.values()], suppressedCount };
}
