// Google Places enrichment client (Tier-2). Live: query the official Places API
// (operator supplies the key/endpoint) for a business by name + region. Offline:
// look the business up in a fixture keyed by exact or normalized company name.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { config } from "../config.js";
import { politeGet } from "../lib/fetcher.js";
import { normalizeCompanyName } from "../lib/normalize.js";
import { parsePlace, type Place } from "../lib/placesParse.js";

const here = dirname(fileURLToPath(import.meta.url));

type Fixture = Record<string, unknown>;
let fixtureCache: Fixture | null = null;
function loadFixture(): Fixture {
  if (!fixtureCache) {
    const path = join(here, "fixtures", "places.json");
    fixtureCache = existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as Fixture) : {};
  }
  return fixtureCache;
}

export async function lookupPlace(
  name: string,
  regionId: string | null,
  opts: { live: boolean },
): Promise<Place | null> {
  if (opts.live) {
    const q = encodeURIComponent(`${name} ${regionId ?? ""}`.trim());
    const json = JSON.parse(await politeGet(`${config.placesUrl}?q=${q}`));
    return parsePlace(json);
  }
  const fx = loadFixture();
  const hit = fx[name] ?? fx[normalizeCompanyName(name)];
  return hit ? parsePlace(hit) : null;
}
