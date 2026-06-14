// e-beszámoló / Céginformációs Szolgálat connector — the company-registry
// backbone (Phase 1a). Built on the paginated factory: live pages a JSON API,
// offline reads ebeszamolo-<region>-pN.json. Records carry registration number
// + TEÁOR, so VAT-matched leads are enriched with authoritative company data.

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { config } from "../config.js";
import {
  parseCompanyRegistryPage,
  type CompanyRegistryPage,
} from "../lib/companyRegistryParse.js";
import { makePaginatedConnector } from "./paginated.js";

const here = dirname(fileURLToPath(import.meta.url));
const LICENSE = "Céginformációs Szolgálat (public company data)";

export const ebeszamoloConnector = makePaginatedConnector({
  id: "ebeszamolo",
  license: LICENSE,
  baseUrl: config.ebeszamoloUrl,
  maxPages: config.directoryMaxPages,
  pageUrl: (regionId, page) =>
    `${config.ebeszamoloUrl}?region=${encodeURIComponent(regionId)}&page=${page}`,
  fixturePath: (regionId, page) => join(here, "fixtures", `ebeszamolo-${regionId}-p${page}.json`),
  parsePage: (body, ctx) => parseCompanyRegistryPage(JSON.parse(body) as CompanyRegistryPage, ctx),
});
