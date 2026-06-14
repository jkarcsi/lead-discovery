// Tier-1 connector: OpenStreetMap via the Overpass API (ODbL — attribution
// required; recorded as sourceLicense on every lead). OSM POIs tagged office /
// shop / craft / healthcare carry name, address, and often phone/website — all
// public, business-level data, no auth or paywall involved.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { config } from "../config.js";
import { politePost } from "../lib/fetcher.js";
import { REGIONS } from "../taxonomy.js";
import type { RawBusiness } from "../types.js";
import type { CollectOptions, Connector } from "./types.js";

const here = dirname(fileURLToPath(import.meta.url));
const LICENSE = "ODbL";

// Region → Overpass area selector, derived from the shared taxonomy so every
// region is collectable countrywide. In OSM Hungary, Budapest and the 19
// counties are admin_level 6 relations; counties are named "<Name> vármegye".
function areaSelector(regionId: string, name: string): string {
  if (regionId === "budapest") {
    return 'area["name"="Budapest"]["admin_level"="6"]';
  }
  // REGIONS names carry " vármegye" only on Pest; normalize then re-append so
  // every county resolves to its official OSM relation name.
  const county = name.replace(/\s*vármegye$/, "");
  return `area["name"="${county} vármegye"]["admin_level"="6"]`;
}

const AREA_QUERY: Record<string, string> = Object.fromEntries(
  REGIONS.map((r) => [r.id, areaSelector(r.id, r.name)]),
);

type OverpassElement = {
  type: string;
  id: number;
  tags?: Record<string, string>;
};
type OverpassResponse = { elements?: OverpassElement[] };

function buildQuery(regionId: string, limit: number): string {
  const area = AREA_QUERY[regionId];
  if (!area) throw new Error(`No Overpass area mapping for region "${regionId}"`);
  return `[out:json][timeout:60];
${area}->.a;
(
  nwr["office"](area.a);
  nwr["shop"](area.a);
  nwr["craft"](area.a);
  nwr["healthcare"](area.a);
);
out center tags ${limit};`;
}

function buildAddress(t: Record<string, string>): string | null {
  const parts = [
    t["addr:postcode"],
    t["addr:city"],
    [t["addr:street"], t["addr:housenumber"]].filter(Boolean).join(" "),
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

export function parseOverpass(json: OverpassResponse, regionId: string): RawBusiness[] {
  const out: RawBusiness[] = [];
  for (const el of json.elements ?? []) {
    const t = el.tags ?? {};
    const name = t.name || t["name:hu"] || t.operator;
    if (!name) continue; // anonymous POIs are useless as leads

    // Tag values describe the activity → categorization input.
    const classificationText = [
      t.office, t.shop, t.craft, t.healthcare, t.amenity, t.description, t["description:hu"],
    ]
      .filter(Boolean)
      .join(" ");

    out.push({
      legalName: name,
      brandName: t.operator && t.operator !== name ? t.operator : null,
      email: t["contact:email"] || t.email || null,
      phone: t["contact:phone"] || t.phone || null,
      website: t["contact:website"] || t.website || null,
      address: buildAddress(t),
      vatNumber: t["ref:vatin"]?.replace(/^HU/i, "") || null,
      registrationNumber: null,
      classificationText: `${classificationText} ${name}`.trim(),
      source: "overpass",
      sourceUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
      sourceLicense: LICENSE,
    });
  }
  return out;
}

function loadFixture(regionId: string): OverpassResponse {
  const path = join(here, "fixtures", `overpass-${regionId}.json`);
  return JSON.parse(readFileSync(path, "utf8")) as OverpassResponse;
}

export const overpassConnector: Connector = {
  id: "overpass",
  license: LICENSE,
  async collect({ regionId, live, limit = 200 }: CollectOptions): Promise<RawBusiness[]> {
    let json: OverpassResponse;
    if (live) {
      const body = buildQuery(regionId, limit);
      json = JSON.parse(await politePost(config.overpassUrl, body)) as OverpassResponse;
    } else {
      json = loadFixture(regionId);
    }
    const records = parseOverpass(json, regionId);
    return typeof limit === "number" ? records.slice(0, limit) : records;
  },
};
