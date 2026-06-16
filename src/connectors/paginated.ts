// Factory for paginated sources. Handles the shared mechanics — concurrent
// windowed pagination (collectPages), live fetch vs offline fixture, the resume
// cursor — so a new source is just a URL builder, a fixture path, and a page
// parser. This is how "more sources" stays cheap (the Phase 2 goal).

import { readFileSync, existsSync } from "node:fs";
import { config } from "../config.js";
import { politeGet, assertLiveEndpoint } from "../lib/fetcher.js";
import { collectPages } from "../lib/paginate.js";
import type { ParseContext, RawBusiness } from "../types.js";
import type { CollectOptions, CollectResult, Connector } from "./types.js";

export type PaginatedSpec = {
  id: string;
  license: string;
  baseUrl: string;
  maxPages: number;
  pageUrl: (regionId: string, page: number) => string;
  fixturePath: (regionId: string, page: number) => string;
  parsePage: (body: string, ctx: ParseContext) => RawBusiness[];
  // Env var that configures baseUrl, named in the "no live endpoint" error.
  envVar?: string;
};

export function makePaginatedConnector(spec: PaginatedSpec): Connector {
  return {
    id: spec.id,
    license: spec.license,
    async collect({ regionId, live, limit, startPage }: CollectOptions): Promise<CollectResult> {
      const ctx: ParseContext = { baseUrl: spec.baseUrl, license: spec.license, source: spec.id };

      if (live) assertLiveEndpoint(spec.baseUrl, spec.id, spec.envVar ?? "the source URL");

      const fetchPage = async (page: number): Promise<RawBusiness[]> => {
        let body: string;
        if (live) {
          body = await politeGet(spec.pageUrl(regionId, page));
        } else {
          const path = spec.fixturePath(regionId, page);
          if (!existsSync(path)) return []; // no further pages offline
          body = readFileSync(path, "utf8");
        }
        return spec.parsePage(body, ctx);
      };

      const { items, lastPage } = await collectPages(fetchPage, {
        window: config.fetchConcurrency,
        maxPages: spec.maxPages,
        startPage: startPage && startPage > 0 ? startPage : 1,
      });
      const records = typeof limit === "number" ? items.slice(0, limit) : items;
      return { records, cursor: { lastPage } };
    },
  };
}
