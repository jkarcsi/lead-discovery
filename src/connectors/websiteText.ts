// Scraped website text for the AI categorizer. The design (§9.1) treats a
// business's own site as a primary, categorizable signal — so for a lead the
// rules couldn't place, we pull a little plain text from its homepage and the
// usual "about / services" pages. Live: politely fetch a few common paths and
// strip to text. Offline: read a fixture keyed by domain. Returns null when
// there's nothing to read (offline: no fixture), matching contactPage.ts.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { politeGet } from "../lib/fetcher.js";
import { stripTags } from "../lib/html.js";

const here = dirname(fileURLToPath(import.meta.url));
// Homepage first, then the pages that usually state what a firm does.
const SITE_PATHS = ["", "/rolunk", "/szolgaltatasok", "/about", "/services"];
// Be impatient scraping arbitrary sites (same rationale as contactPage): no
// retries, short timeout, so a slow/dead site can't cost retries × timeout.
const SCRAPE_OPTS = { retries: 0, timeoutMs: 8000 } as const;
// Enough text to classify into six buckets; the lib caps again per lead.
const MAX_CHARS = 4000;

export async function fetchSiteText(
  domain: string,
  opts: { live: boolean },
): Promise<string | null> {
  if (opts.live) {
    const chunks: string[] = [];
    for (const path of SITE_PATHS) {
      try {
        const text = stripTags(await politeGet(`https://${domain}${path}`, SCRAPE_OPTS));
        if (text) chunks.push(text);
        if (chunks.join(" ").length >= MAX_CHARS) break; // enough signal — stop
      } catch {
        // try the next path
      }
    }
    const joined = chunks.join(" ").slice(0, MAX_CHARS).trim();
    return joined || null;
  }

  // Offline: a fixture (HTML stripped to text, or a plain .txt) keyed by domain.
  for (const ext of ["html", "txt"]) {
    const file = join(here, "fixtures", "site", `${domain}.${ext}`);
    if (existsSync(file)) {
      const raw = readFileSync(file, "utf8");
      const text = ext === "html" ? stripTags(raw) : raw.replace(/\s+/g, " ").trim();
      return text.slice(0, MAX_CHARS) || null;
    }
  }
  return null;
}
