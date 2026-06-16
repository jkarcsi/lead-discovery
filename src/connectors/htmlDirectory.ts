// HTML business-listing connector — same paginated pattern as `directory`, but
// the pages are HTML scraped by the dependency-free `parseHtmlDirectory`.
// Offline reads htmldir-<region>-pN.html; live pages an HTML listing.

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { config } from "../config.js";
import { parseHtmlDirectory } from "../lib/htmlDirectoryParse.js";
import { makePaginatedConnector } from "./paginated.js";

const here = dirname(fileURLToPath(import.meta.url));
const LICENSE = "directory (public HTML listing)";

export const htmlDirectoryConnector = makePaginatedConnector({
  id: "htmldir",
  license: LICENSE,
  baseUrl: config.htmlDirectoryUrl,
  envVar: "HTML_DIRECTORY_URL",
  maxPages: config.directoryMaxPages,
  pageUrl: (regionId, page) =>
    `${config.htmlDirectoryUrl}/${encodeURIComponent(regionId)}?p=${page}`,
  fixturePath: (regionId, page) => join(here, "fixtures", `htmldir-${regionId}-p${page}.html`),
  parsePage: (body, ctx) => parseHtmlDirectory(body, ctx),
});
