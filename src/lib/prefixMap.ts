// Shared prefix-based code → taxonomy classification (pure). Both CPV
// (procurement) and TEÁOR (activity) codes are hierarchical, so we map by code
// prefix to our category ids. A code may match several rules (union); only ids
// that exist in the taxonomy are kept.

import { CATEGORIES } from "../taxonomy.js";

export type PrefixRule = { prefix: string; category: string };

const VALID = new Set(CATEGORIES.map((c) => c.id));

export function categoriesForCodes(
  codes: string[],
  normalize: (code: string) => string,
  rules: PrefixRule[],
): string[] {
  const out = new Set<string>();
  for (const raw of codes ?? []) {
    const code = normalize(raw);
    if (!code) continue;
    for (const { prefix, category } of rules) {
      if (code.startsWith(prefix) && VALID.has(category)) out.add(category);
    }
  }
  return [...out];
}
