// Public-procurement connector (Közbeszerzési Értesítő / EKR). Discovers active
// suppliers from award notices and categorizes them from CPV codes. Built on the
// paginated factory: live pages a JSON API, offline reads
// kozbeszerzes-<region>-pN.json. Suppliers overlap other sources by VAT and merge.

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { config } from "../config.js";
import { parseProcurementPage, type ProcurementPage } from "../lib/procurementParse.js";
import { makePaginatedConnector } from "./paginated.js";

const here = dirname(fileURLToPath(import.meta.url));
const LICENSE = "Közbeszerzési Értesítő (public procurement)";

export const kozbeszerzesConnector = makePaginatedConnector({
  id: "kozbeszerzes",
  license: LICENSE,
  baseUrl: config.kozbeszerzesUrl,
  maxPages: config.directoryMaxPages,
  pageUrl: (regionId, page) =>
    `${config.kozbeszerzesUrl}?region=${encodeURIComponent(regionId)}&page=${page}`,
  fixturePath: (regionId, page) => join(here, "fixtures", `kozbeszerzes-${regionId}-p${page}.json`),
  parsePage: (body, ctx) => parseProcurementPage(JSON.parse(body) as ProcurementPage, ctx),
});
