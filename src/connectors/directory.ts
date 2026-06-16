// Generic paginated JSON business-directory connector, built on the paginated
// factory. Offline it reads numbered fixtures (directory-<region>-pN.json) and
// stops when the next file is absent; live it pages a JSON API. Overlapping
// businesses merge across sources on the dedupe key.

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { config } from "../config.js";
import { parseDirectoryPage, type DirectoryPage } from "../lib/directoryParse.js";
import { makePaginatedConnector } from "./paginated.js";

const here = dirname(fileURLToPath(import.meta.url));
const LICENSE = "directory (public listing)";

export const directoryConnector = makePaginatedConnector({
  id: "directory",
  license: LICENSE,
  baseUrl: config.directoryUrl,
  envVar: "DIRECTORY_URL",
  maxPages: config.directoryMaxPages,
  pageUrl: (regionId, page) =>
    `${config.directoryUrl}?region=${encodeURIComponent(regionId)}&page=${page}`,
  fixturePath: (regionId, page) => join(here, "fixtures", `directory-${regionId}-p${page}.json`),
  parsePage: (body, ctx) => parseDirectoryPage(JSON.parse(body) as DirectoryPage, ctx),
});
