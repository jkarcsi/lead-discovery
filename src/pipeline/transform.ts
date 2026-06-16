// Pure transform: a raw connector record → a normalized, categorized LeadInput.
// No I/O, so it is fully unit-testable.

import { categorize, detectRegion } from "../lib/categorize.js";
import {
  normalizeEmail,
  normalizePhone,
  domainFromUrl,
} from "../lib/normalize.js";
import type { LeadInput, RawBusiness } from "../types.js";

// Sole-trader / named-contact markers → the lead is personal data (full GDPR).
const PERSONAL_DATA_MARKERS = [
  "e.v.",
  "ev.",
  "egyéni vállalkozó",
  "egyeni vallalkozo",
  "őstermelő",
  "ostermelo",
];

function looksPersonal(legalName: string, email: string | null): boolean {
  const name = legalName.toLowerCase();
  if (PERSONAL_DATA_MARKERS.some((m) => name.includes(m))) return true;
  // A "firstname.lastname@" style mailbox is a named person, not a general inbox.
  if (email) {
    const local = email.split("@")[0];
    const general = /^(info|iroda|office|kapcsolat|contact|hello|sales|ugyfel|ugyfelszolgalat|admin|titkarsag|rendeles)/;
    if (!general.test(local) && /^[a-z]+[._][a-z]+$/.test(local)) return true;
  }
  return false;
}

export function transform(raw: RawBusiness): LeadInput {
  const email = normalizeEmail(raw.email);
  const phone = normalizePhone(raw.phone);
  const domain = domainFromUrl(raw.website);
  const classificationText = [raw.classificationText, raw.legalName, raw.brandName]
    .filter(Boolean)
    .join(" ");
  // Keyword-derived categories, unioned with any the connector provided (CPV).
  const categories = Array.from(new Set([...categorize(classificationText), ...(raw.categories ?? [])]));
  const regionId = detectRegion(raw.address);

  return {
    legalName: raw.legalName.trim(),
    brandName: raw.brandName?.trim() || null,
    email,
    phone,
    website: raw.website?.trim() || null,
    domain,
    address: raw.address?.trim() || null,
    vatNumber: raw.vatNumber?.trim() || null,
    registrationNumber: raw.registrationNumber?.trim() || null,
    regionId,
    categories,
    classificationText: classificationText || null,
    source: raw.source,
    sourceUrl: raw.sourceUrl ?? null,
    sourceLicense: raw.sourceLicense ?? null,
    isPersonalData: raw.isPersonalData === true || looksPersonal(raw.legalName, email),
  };
}
