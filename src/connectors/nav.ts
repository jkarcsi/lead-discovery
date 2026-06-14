// NAV (tax authority) lookup client. Keyed by the 8-digit HU VAT base (reusing
// the VIES helper). Live queries a JSON API through the polite layer; offline
// reads a fixture map keyed by the VAT base. Returns null when there's nothing
// to check (not a valid HU VAT) or — offline — no fixture entry.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { config } from "../config.js";
import { politeGet } from "../lib/fetcher.js";
import { huVatForVies } from "../lib/vies.js";
import { parseNavResponse, type NavSignals } from "../lib/navParse.js";

const here = dirname(fileURLToPath(import.meta.url));

type Fixture = Record<string, unknown>;
let fixtureCache: Fixture | null = null;
function loadFixture(): Fixture {
  if (!fixtureCache) {
    fixtureCache = JSON.parse(readFileSync(join(here, "fixtures", "nav.json"), "utf8")) as Fixture;
  }
  return fixtureCache;
}

export async function checkTaxNumber(
  vatNumber: string | null | undefined,
  opts: { live: boolean },
): Promise<NavSignals | null> {
  const core = huVatForVies(vatNumber);
  if (!core) return null;

  if (opts.live) {
    const body = await politeGet(`${config.navUrl}/${core}`);
    return parseNavResponse(JSON.parse(body));
  }

  const fx = loadFixture();
  return core in fx ? parseNavResponse(fx[core]) : null;
}
