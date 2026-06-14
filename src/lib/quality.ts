// Pure quality scoring (0–100): how usable a lead is for matching + outreach.
// Higher = more complete and verifiable. Used to rank the review queue and to
// gate which leads are eligible for (gated) cold outreach later.

import { isValidHuVat } from "./normalize.js";
import type { LeadInput } from "../types.js";

export function qualityScore(lead: LeadInput): number {
  let score = 0;
  if (lead.email) score += 30; // reachability is the most valuable signal
  if (lead.phone) score += 10;
  if (lead.website || lead.domain) score += 10;
  if (lead.address) score += 10;
  if (lead.regionId) score += 10;
  if (lead.categories.length > 0) score += 15;
  if (lead.vatNumber && isValidHuVat(lead.vatNumber)) score += 15;
  return Math.min(100, score);
}
