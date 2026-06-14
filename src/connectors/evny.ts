// EVNY sole-trader registry connector — SENSITIVE (personal data). It is
// flag-gated: collection throws unless the operator has set EVNY_ENABLED=true.
// Records are always flagged personal data (see parseEvnyPage). Built on the
// paginated factory, wrapped with the gate.

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { config } from "../config.js";
import { parseEvnyPage, type EvnyPage } from "../lib/evnyParse.js";
import { makePaginatedConnector } from "./paginated.js";
import type { CollectOptions, CollectResult, Connector } from "./types.js";

const here = dirname(fileURLToPath(import.meta.url));
const LICENSE = "EVNY (sole-trader registry, personal data)";

const inner = makePaginatedConnector({
  id: "evny",
  license: LICENSE,
  baseUrl: config.evnyUrl,
  maxPages: config.directoryMaxPages,
  pageUrl: (regionId, page) => `${config.evnyUrl}?region=${encodeURIComponent(regionId)}&page=${page}`,
  fixturePath: (regionId, page) => join(here, "fixtures", `evny-${regionId}-p${page}.json`),
  parsePage: (body, ctx) => parseEvnyPage(JSON.parse(body) as EvnyPage, ctx),
});

export const evnyConnector: Connector = {
  id: inner.id,
  license: inner.license,
  async collect(opts: CollectOptions): Promise<CollectResult> {
    if (!config.evnyEnabled) {
      throw new Error(
        "EVNY is a sensitive source (sole-trader personal data). Set EVNY_ENABLED=true to enable collection.",
      );
    }
    return inner.collect(opts);
  },
};
