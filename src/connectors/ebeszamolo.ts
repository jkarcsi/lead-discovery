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
const LICENSE = "Céginformációs Szolgálat (company data — usage agreement required for bulk)";

export const ebeszamoloConnector = makePaginatedConnector({
  id: "ebeszamolo",
  license: LICENSE,
  baseUrl: config.ebeszamoloUrl,
  envVar: "EBESZAMOLO_URL",
  // The Céginformációs Szolgálat ToS forbids automated/bulk access (data
  // scraping) of the free e-cegjegyzek.hu lookup without a contract. Bulk data
  // is available only under a usage agreement with the Céginformációs Szolgálat,
  // or via a licensed API (e.g. Cégadat API / OPTEN). We never bypass the
  // CAPTCHA-gated free site.
  licence: {
    licensed: config.ebeszamoloLicensed,
    flagEnv: "EBESZAMOLO_LICENSED",
    note:
      "The free e-cegjegyzek.hu lookup is CAPTCHA-gated and its ToS forbids automated/bulk " +
      "access; obtain a usage agreement with the Céginformációs Szolgálat (ceginformaciosszolgalat.kormany.hu) " +
      "or use a licensed API (e.g. cegadatapi.hu / OPTEN), and point EBESZAMOLO_URL at that endpoint.",
  },
  maxPages: config.directoryMaxPages,
  pageUrl: (regionId, page) =>
    `${config.ebeszamoloUrl}?region=${encodeURIComponent(regionId)}&page=${page}`,
  fixturePath: (regionId, page) => join(here, "fixtures", `ebeszamolo-${regionId}-p${page}.json`),
  parsePage: (body, ctx) => parseCompanyRegistryPage(JSON.parse(body) as CompanyRegistryPage, ctx),
});
