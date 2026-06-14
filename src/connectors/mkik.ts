// MKIK (Magyar Kereskedelmi és Iparkamara) chamber registry connector — a
// coverage cross-check: chamber registration is mandatory, so this widens
// coverage and confirms companies by VAT against the other sources. The record
// shape matches the company registry, so it reuses `parseCompanyRegistryPage`
// (the paginated factory makes a new source nearly free).

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { config } from "../config.js";
import { parseCompanyRegistryPage, type CompanyRegistryPage } from "../lib/companyRegistryParse.js";
import { makePaginatedConnector } from "./paginated.js";

const here = dirname(fileURLToPath(import.meta.url));
const LICENSE = "MKIK kamarai nyilvántartás (chamber registry)";

export const mkikConnector = makePaginatedConnector({
  id: "mkik",
  license: LICENSE,
  baseUrl: config.mkikUrl,
  maxPages: config.directoryMaxPages,
  pageUrl: (regionId, page) =>
    `${config.mkikUrl}?region=${encodeURIComponent(regionId)}&page=${page}`,
  fixturePath: (regionId, page) => join(here, "fixtures", `mkik-${regionId}-p${page}.json`),
  parsePage: (body, ctx) => parseCompanyRegistryPage(JSON.parse(body) as CompanyRegistryPage, ctx),
});
