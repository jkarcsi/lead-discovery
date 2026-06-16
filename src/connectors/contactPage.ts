// Tier-2 contact-page client. Live: politely fetch a lead's website (trying a
// few common contact paths) and extract contacts. Offline: read a fixture HTML
// keyed by domain. Returns null when there's no page to read (offline: no
// fixture), or an empty result when a page yielded nothing.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { politeGet } from "../lib/fetcher.js";
import { extractContacts, type Contacts } from "../lib/contactExtract.js";

const here = dirname(fileURLToPath(import.meta.url));
const CONTACT_PATHS = ["", "/kapcsolat", "/impresszum", "/contact"];
// Scraping arbitrary sites: be impatient. No retries and a short timeout keep a
// slow/dead site from costing retries × timeout across several paths (the cause
// of enrich crawls dragging on). Email is the deliverable, so stop once we have
// one rather than fetching every path for a phone we may already have.
const SCRAPE_OPTS = { retries: 0, timeoutMs: 8000 } as const;

export async function fetchContacts(
  domain: string,
  opts: { live: boolean },
): Promise<Contacts | null> {
  if (opts.live) {
    const merged: Contacts = { emails: [], phones: [] };
    for (const path of CONTACT_PATHS) {
      try {
        const c = extractContacts(await politeGet(`https://${domain}${path}`, SCRAPE_OPTS));
        for (const e of c.emails) if (!merged.emails.includes(e)) merged.emails.push(e);
        for (const p of c.phones) if (!merged.phones.includes(p)) merged.phones.push(p);
        if (merged.emails.length) break; // email found → done (the priority field)
      } catch {
        // try the next path
      }
    }
    return merged;
  }

  const file = join(here, "fixtures", "contact", `${domain}.html`);
  if (!existsSync(file)) return null;
  return extractContacts(readFileSync(file, "utf8"));
}
