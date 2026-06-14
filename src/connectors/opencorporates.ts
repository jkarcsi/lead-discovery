// OpenCorporates connector — an aggregator that normalizes company identity
// across sources. Its value here is the canonical company number, which (via the
// registration-number dedupe tier) merges records that share a cégjegyzékszám
// even when names are spelled differently. Same company-record shape, so it
// reuses `parseCompanyRegistryPage` on the paginated factory.

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { config } from "../config.js";
import { parseCompanyRegistryPage, type CompanyRegistryPage } from "../lib/companyRegistryParse.js";
import { makePaginatedConnector } from "./paginated.js";

const here = dirname(fileURLToPath(import.meta.url));
const LICENSE = "OpenCorporates (aggregated public company data)";

export const openCorporatesConnector = makePaginatedConnector({
  id: "opencorporates",
  license: LICENSE,
  baseUrl: config.openCorporatesUrl,
  maxPages: config.directoryMaxPages,
  pageUrl: (regionId, page) =>
    `${config.openCorporatesUrl}?q=${encodeURIComponent(regionId)}&page=${page}`,
  fixturePath: (regionId, page) =>
    join(here, "fixtures", `opencorporates-${regionId}-p${page}.json`),
  parsePage: (body, ctx) => parseCompanyRegistryPage(JSON.parse(body) as CompanyRegistryPage, ctx),
});
