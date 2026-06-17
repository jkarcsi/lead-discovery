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
  // Sources whose data is only available under a usage agreement — e.g. the
  // company registry (Céginformációs Szolgálat), whose ToS forbids automated /
  // bulk access (data scraping) without a contract. Live collection is blocked
  // until the operator confirms a licence by setting `flagEnv`=true; `note`
  // explains how to obtain legitimate access.
  licence?: { licensed: boolean; flagEnv: string; note: string };
};

export function makePaginatedConnector(spec: PaginatedSpec): Connector {
  return {
    id: spec.id,
    license: spec.license,
    async collect({ regionId, live, limit, startPage }: CollectOptions): Promise<CollectResult> {
      const ctx: ParseContext = { baseUrl: spec.baseUrl, license: spec.license, source: spec.id };

      if (live && spec.licence && !spec.licence.licensed) {
        throw new Error(
          `source "${spec.id}" needs a data-usage agreement before live collection. ` +
            `${spec.licence.note} Then set ${spec.licence.flagEnv}=true to confirm.`,
        );
      }
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
