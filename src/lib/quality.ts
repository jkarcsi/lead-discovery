// Pure quality scoring (0–100): how usable a lead is for matching + outreach.
// Higher = more complete and verifiable. Used to rank the review queue and to
// gate which leads are eligible for (gated) cold outreach later.

import { isValidHuVat } from "./normalize.js";
import type { LeadInput } from "../types.js";

// `vatVerified` is the outcome of an external VAT check (VIES); when known it
// supersedes the local checksum heuristic and earns a small extra-confidence
// bonus. `undefined` = not yet verified (fall back to the checksum signal).
export function qualityScore(lead: LeadInput, vatVerified?: boolean): number {
  let score = 0;
  if (lead.email) score += 30; // reachability is the most valuable signal
  if (lead.phone) score += 10;
  if (lead.website || lead.domain) score += 10;
  if (lead.address) score += 10;
  if (lead.regionId) score += 10;
  if (lead.categories.length > 0) score += 15;

  const vatLooksValid = !!lead.vatNumber && isValidHuVat(lead.vatNumber);
  if (vatVerified === true) {
    score += 20; // externally confirmed — strongest VAT signal
  } else if (vatVerified === false) {
    score += 0; // confirmed invalid — no credit even if the checksum passed
  } else if (vatLooksValid) {
    score += 15; // checksum-only (not yet externally verified)
  }
  return Math.min(100, score);
}
