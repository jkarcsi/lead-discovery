// CPV (Common Procurement Vocabulary) → Procura taxonomy mapping (pure).
// Procurement notices classify the subject by CPV code; we map the relevant
// codes to our service categories so a won tender authoritatively categorizes
// the winning supplier.

import { categoriesForCodes, type PrefixRule } from "./prefixMap.js";

const CPV_RULES: PrefixRule[] = [
  { prefix: "9091", category: "cleaning" }, // cleaning services
  { prefix: "90919", category: "cleaning" }, // office/building cleaning
  { prefix: "45331", category: "hvac" }, // heating/ventilation/AC installation
  { prefix: "50730", category: "hvac" }, // repair & maintenance of cooling groups
  { prefix: "42500", category: "hvac" }, // cooling and ventilation equipment
  { prefix: "42510", category: "hvac" }, // heat exchangers, AC
  { prefix: "7971", category: "security" }, // security services
  { prefix: "79713", category: "security" }, // guard services
  { prefix: "71317", category: "occupational-safety" }, // hazard protection consultancy
  { prefix: "85147", category: "occupational-safety" }, // occupational health services
  { prefix: "35111", category: "fire-safety" }, // fire-fighting equipment
  { prefix: "75251", category: "fire-safety" }, // firefighting services
  { prefix: "72", category: "it-support" }, // IT services
  { prefix: "50312", category: "it-support" }, // maintenance of computer equipment
  { prefix: "30200", category: "it-support" }, // computer equipment
];

// Keep the 8-digit class code (drop the check digit / formatting).
const normalizeCpv = (code: string): string => String(code).replace(/\D/g, "").slice(0, 8);

export function cpvToCategories(cpvCodes: string[]): string[] {
  return categoriesForCodes(cpvCodes, normalizeCpv, CPV_RULES);
}
