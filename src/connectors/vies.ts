// EU VIES VAT verification client (side-effecting). Offline it reads a fixture
// keyed by the 8-digit HU VAT base; live it calls the VIES REST API through the
// polite (identified UA + throttled) layer. Pure parsing/decisions live in
// `lib/vies.ts`. VIES is a free EC service intended for verifying a business
// partner's VAT — using it to confirm a collected lead's VAT is within purpose.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { config } from "../config.js";
import { politePostJson } from "../lib/fetcher.js";
import { huVatForVies, parseViesResponse, type ViesResult } from "../lib/vies.js";

const here = dirname(fileURLToPath(import.meta.url));
export const VIES_LICENSE = "EU VIES (European Commission)";

type Fixture = Record<string, unknown>;
let fixtureCache: Fixture | null = null;
function loadFixture(): Fixture {
  if (!fixtureCache) {
    const path = join(here, "fixtures", "vies.json");
    fixtureCache = JSON.parse(readFileSync(path, "utf8")) as Fixture;
  }
  return fixtureCache;
}

// Verify a Hungarian VAT number. Returns null when the number isn't a valid HU
// VAT (nothing to check) or — offline — when no fixture entry exists for it.
export async function checkVat(
  vatNumber: string | null | undefined,
  opts: { live: boolean },
): Promise<ViesResult | null> {
  const core = huVatForVies(vatNumber);
  if (!core) return null;

  if (opts.live) {
    const body = await politePostJson(config.viesUrl, { countryCode: "HU", vatNumber: core });
    return parseViesResponse(JSON.parse(body));
  }

  const fx = loadFixture();
  return core in fx ? parseViesResponse(fx[core]) : null;
}
