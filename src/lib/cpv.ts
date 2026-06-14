// CPV (Common Procurement Vocabulary) → Procura taxonomy mapping (pure, no I/O).
// Procurement notices classify the subject by CPV code; we map the relevant
// codes to our service categories so a won tender authoritatively categorizes
// the winning supplier. Matching is by code prefix (CPV is hierarchical), and a
// code may match several entries (union of categories).

import { CATEGORIES } from "../taxonomy.js";

const CPV_PREFIX_MAP: { prefix: string; category: string }[] = [
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

const VALID = new Set(CATEGORIES.map((c) => c.id));

function normalizeCpv(code: string): string {
  // Strip the check digit / formatting and keep the 8-digit class code.
  return String(code).replace(/\D/g, "").slice(0, 8);
}

export function cpvToCategories(cpvCodes: string[]): string[] {
  const cats = new Set<string>();
  for (const raw of cpvCodes ?? []) {
    const code = normalizeCpv(raw);
    if (!code) continue;
    for (const { prefix, category } of CPV_PREFIX_MAP) {
      if (code.startsWith(prefix) && VALID.has(category)) cats.add(category);
    }
  }
  return [...cats];
}
