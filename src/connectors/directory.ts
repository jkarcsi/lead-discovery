// Generic paginated JSON business-directory connector. Pages are fetched
// concurrently in windows (collectPages → mapWithConcurrency) and parsed by the
// pure `parseDirectoryPage`. Offline it reads numbered fixtures
// (directory-<region>-pN.json) and stops when the next file is absent; live it
// pages a JSON API until an empty page. A second source like this is the point
// of the dedupe key — overlapping businesses merge across sources.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { config } from "../config.js";
import { politeGet } from "../lib/fetcher.js";
import { collectPages } from "../lib/paginate.js";
import { parseDirectoryPage, type DirectoryContext, type DirectoryPage } from "../lib/directoryParse.js";
import type { RawBusiness } from "../types.js";
import type { CollectOptions, CollectResult, Connector } from "./types.js";

const here = dirname(fileURLToPath(import.meta.url));
const LICENSE = "directory (public listing)";

function fixturePath(regionId: string, page: number): string {
  return join(here, "fixtures", `directory-${regionId}-p${page}.json`);
}

export const directoryConnector: Connector = {
  id: "directory",
  license: LICENSE,
  async collect({ regionId, live, limit, startPage }: CollectOptions): Promise<CollectResult> {
    const ctx: DirectoryContext = { baseUrl: config.directoryUrl, license: LICENSE };

    const fetchPage = async (page: number): Promise<RawBusiness[]> => {
      let json: DirectoryPage;
      if (live) {
        const url = `${config.directoryUrl}?region=${encodeURIComponent(regionId)}&page=${page}`;
        json = JSON.parse(await politeGet(url)) as DirectoryPage;
      } else {
        const path = fixturePath(regionId, page);
        if (!existsSync(path)) return []; // no further pages offline
        json = JSON.parse(readFileSync(path, "utf8")) as DirectoryPage;
      }
      return parseDirectoryPage(json, ctx);
    };

    const { items, lastPage } = await collectPages(fetchPage, {
      window: config.fetchConcurrency,
      maxPages: config.directoryMaxPages,
      startPage: startPage && startPage > 0 ? startPage : 1,
    });
    const records = typeof limit === "number" ? items.slice(0, limit) : items;
    return { records, cursor: { lastPage } };
  },
};
