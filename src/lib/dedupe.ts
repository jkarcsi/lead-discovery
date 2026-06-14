// Pure dedupe-key derivation (no I/O). The key is the stable identity of a
// business so re-collection from any source merges instead of duplicating.
//
// Priority (most → least authoritative):
//   1. VAT number (validated 8-digit core)
//   2. registration number (cégjegyzékszám) — catches registry/aggregator
//      records that share a company number but lack a VAT, even across name
//      spelling variations
//   3. website domain
//   4. normalized company name + region
//
// The key is prefixed by its kind so two leads only collide when they share the
// SAME kind of identity (a VAT match and a domain match never alias).

import { digitsOnly, isValidHuVat, isValidRegNumber, normalizeCompanyName } from "./normalize.js";
import type { LeadInput } from "../types.js";

export function dedupeKey(
  lead: Pick<LeadInput, "vatNumber" | "registrationNumber" | "domain" | "legalName" | "regionId">,
): string {
  if (lead.vatNumber && isValidHuVat(lead.vatNumber)) {
    return "vat:" + digitsOnly(lead.vatNumber).slice(0, 8);
  }
  if (lead.registrationNumber && isValidRegNumber(lead.registrationNumber)) {
    return "reg:" + digitsOnly(lead.registrationNumber);
  }
  if (lead.domain) {
    return "domain:" + lead.domain.toLowerCase();
  }
  const name = normalizeCompanyName(lead.legalName);
  return "name:" + name + "|" + (lead.regionId ?? "");
}

// When the same business is collected twice, prefer the record that carries
// more verifiable signal. Returns the fields to keep, favoring `incoming` only
// where it adds information the `existing` record lacks.
export function mergeLead(existing: LeadInput, incoming: LeadInput): LeadInput {
  const pick = <T>(a: T | null | undefined, b: T | null | undefined): T | null =>
    (a ?? b ?? null) as T | null;
  return {
    ...existing,
    brandName: pick(existing.brandName, incoming.brandName),
    email: pick(existing.email, incoming.email),
    phone: pick(existing.phone, incoming.phone),
    website: pick(existing.website, incoming.website),
    domain: pick(existing.domain, incoming.domain),
    address: pick(existing.address, incoming.address),
    vatNumber: pick(existing.vatNumber, incoming.vatNumber),
    registrationNumber: pick(existing.registrationNumber, incoming.registrationNumber),
    regionId: pick(existing.regionId, incoming.regionId),
    // Union of categories from both observations.
    categories: Array.from(new Set([...existing.categories, ...incoming.categories])),
    // Personal-data flag is sticky: once any source says so, treat as such.
    isPersonalData: existing.isPersonalData || incoming.isPersonalData,
  };
}
