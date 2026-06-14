// Pure categorization (no I/O): map a business's free-text hints and address to
// Procura category ids and a region id, using the shared taxonomy. This mirrors
// Procura's own keyword detection so leads slot straight into its matching.

import { CATEGORIES, REGION_KEYWORDS } from "../taxonomy.js";

// Accent-fold + lowercase so "Pécs" and "pecs" both match.
function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// Return every category whose keywords appear in the text. A lead can belong to
// several categories (e.g. a facility-services firm doing cleaning + security).
export function categorize(text: string | null | undefined): string[] {
  const hay = fold(text ?? "");
  if (!hay) return [];
  const hits: string[] = [];
  for (const cat of CATEGORIES) {
    if (cat.keywords.some((kw) => hay.includes(fold(kw)))) hits.push(cat.id);
  }
  return hits;
}

// Best-effort region id from an address / place string. Budapest wins over a
// generic "pest" mention so a Budapest address isn't mislabeled Pest county.
export function detectRegion(address: string | null | undefined): string | null {
  const hay = fold(address ?? "");
  if (!hay) return null;

  // Hungarian postal codes: 1xxx = Budapest. Quick, reliable signal.
  const zip = hay.match(/\b(\d{4})\b/);
  if (zip && zip[1][0] === "1") return "budapest";

  if (REGION_KEYWORDS.budapest.some((kw) => hay.includes(fold(kw)))) return "budapest";

  for (const [regionId, keywords] of Object.entries(REGION_KEYWORDS)) {
    if (regionId === "budapest") continue;
    if (keywords.some((kw) => hay.includes(fold(kw)))) return regionId;
  }
  return null;
}
