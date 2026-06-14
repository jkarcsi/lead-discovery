# Implementation Plan

**Lead Discovery** is a fast, reliable scraping engine that gathers Hungarian
business data from the best available public sources into one categorized,
deduplicated database. The taxonomy (category × region) mirrors Procura's, so
collected leads slot straight into matching.

- **Repository:** `jkarcsi/lead-discovery`
- **Working branch:** `claude/intelligent-allen-xv65ne` (merged to `main` by fast-forward)

## Goals

Efficiency first: maximize throughput and source coverage, minimize wasted
round-trips, and keep crawls resilient and idempotent.

- **High throughput** — fetch sources/pages concurrently; the network is the
  bottleneck, not the CPU.
- **Few round-trips** — batch DB reads/writes (`createMany`, transactions, a
  single suppression load), not per-record queries.
- **Resilient** — retries with exponential backoff, an in-run response cache, and
  per-region/source isolation so one failure never aborts a batch.
- **Idempotent & incremental** — re-runs merge on the dedupe key and resume
  paginated sources from a saved cursor, fetching only new pages.
- **Cheap to extend** — a new source is a URL builder, a fixture path, and a pure
  page parser plugged into `connectors/paginated.ts`.

> **Scope.** This project covers data collection only. The legality of acquiring
> and using the data is owned by the operator as a separate workstream and is not
> gated here. Throughput-prudent defaults (identified User-Agent, tunable
> per-host rate limits, retries/backoff) are kept because they prevent IP bans
> and throttling; provenance fields are kept because they aid deduplication. See
> [`docs/SCOPE.md`](docs/SCOPE.md).

## Source coverage roadmap

Built top-down by value; each source widens coverage, and overlapping businesses
merge across sources on the dedupe key (VAT → domain → name+region).

| # | Source | Role | Status |
|---|--------|------|--------|
| 1 | OSM / Overpass | Discovery POIs | ✅ all 20 regions |
| 2 | e-beszámoló / Céginformációs Szolgálat | Company master + reg. number + TEÁOR | ✅ connector |
| 3 | NAV databases | Verification / risk signals | ◻ next |
| 4 | VIES (EU VAT) | VAT validation | ✅ `verify` step |
| 5 | Közbeszerzés (EKR / TED) | Active-supplier proof | ◻ |
| 6 | KSH-TEÁOR | Classification reference | ◻ |
| 7 | MKIK chamber | Coverage cross-check | ◻ |
| 8 | OpenCorporates | Aggregator / normalization | ◻ |
| 9 | Google Places API | Contact enrichment (official API) | ◻ |
| 10 | Website contact pages | Email / phone enrichment | ◻ `htmldir` scraper exists |
| 11 | Aranyoldalak / Telefonkönyv | Listings | ◻ generic paginated connector exists |
| 12 | EVNY (sole traders) | Sole-trader coverage | ◻ flag-gated, last |

## Milestones

- ✅ **M1 — Collection MVP:** schema, taxonomy, pure libraries, resilient fetcher,
  Overpass connector (all 20 regions), batched concurrent ingest, operator CLI.
- 🟡 **M1a — Registry backbone:** e-beszámoló connector (master data + registration
  number + TEÁOR, enriches existing leads by VAT). Remaining: financial fields.
- ◻ **M1b — Tax verification:** NAV connector (headcount, debt-free flag,
  execution-risk signals); batch driver over the existing VIES `verify`.
- ◻ **M1c — Procurement signal:** EKR / Közbeszerzési Értesítő / TED connector;
  CPV → taxonomy mapping.
- ◻ **M1d — Classification & cross-check:** KSH-TEÁOR tables, MKIK, OpenCorporates.
- ◻ **M2 — Tier-2 enrichment:** Google Places (official API) + polite crawl;
  quality-scoring refinements.
- ◻ **M2s — Sole traders (EVNY):** behind an explicit flag, built last.
- ◻ **M3 — Scale & operate:** throughput dashboards, scheduled incremental
  refresh, export to Procura.

**Operator utilities** (shipped, maintained but not the focus): `verify` (VIES),
`review` (manual approve/reject queue), `suppress`/`purge` (do-not-collect +
retention), `dsar` (access/erasure), `ropa` (generated Art. 30 record).

## Engineering conventions

1. **Language split** — Hungarian for anything user-facing; English for the
   codebase (identifiers, comments, commits, docs, tests).
2. **Branch discipline** — develop on the working branch; reach `main` only by a
   fast-forward of it. No pull request unless requested.
3. **Taxonomy parity** — category/region ids must match Procura's so leads slot
   into matching.
4. **Green before push** — `npm test` and `npm run build` (tsc) must pass. The
   pipeline runs fully offline via fixtures (`--live` is opt-in); pure libraries
   stay I/O-free and unit-tested.
5. **Throughput over evasion** — keep tunable rate-limits/backoff/UA; never build
   auth/paywall/CAPTCHA bypass or ban-evasion.
6. **New sources via the factory** — `connectors/paginated.ts` owns pagination,
   live/fixture switching, and the resume cursor.

## Getting started

```bash
npm install
cp .env.example .env
npx prisma generate
npx prisma db push
npm test
npm run build
npm run cli -- collect --source overpass --region budapest
npm run cli -- stats
```

## Project structure

```
prisma/schema.prisma   Lead / Suppression / AuditEvent / CrawlState
src/taxonomy.ts        Procura-aligned categories + regions
src/lib/               pure, tested: parsers, concurrency, paginate, dedupe,
                       quality, …; + side-effecting fetcher
src/connectors/        overpass, directory, htmldir, ebeszamolo
                       + paginated.ts factory + offline fixtures
src/pipeline/          ingest (concurrent) → store (batched); verify, review,
                       purge, dsar, crawlState
src/cli.ts             operator CLI
tests/                 vitest unit tests
docs/SCOPE.md          scope + efficiency tooling
docs/ROPA.md           generated processing record
```

## Development workflow

1. Read this plan (esp. the progress log) and `docs/SCOPE.md`.
2. Pick the next open roadmap/milestone item (currently **M1b — NAV connector**),
   biasing toward throughput and coverage.
3. Implement with tests: pure logic in `src/lib/*`, side effects in
   `src/pipeline/*` and `src/connectors/*` (new sources via the paginated factory).
4. Verify green: `npm test`, `npm run build`, an offline CLI smoke.
5. Commit with a clear message, push to the working branch, fast-forward `main`.
6. Append a dated entry to the progress log.

## Progress log (newest first)

### 2026-06-14

- **Plan reframed** from a development routine into this implementation plan
  (renamed from `ROUTINE_PROMPT.md`); efficiency-first throughout.
- **M1a — registry backbone:** added the e-beszámoló / Céginformációs Szolgálat
  connector (`connectors/ebeszamolo.ts` on the paginated factory) with a pure
  company-registry parser. Records carry the registration number (cégjegyzékszám)
  and TEÁOR activity, and merge into existing leads by VAT to enrich them with
  authoritative company identity. 97 tests green.
- **Enrichment / coverage to date:** VIES `verify`, retention/`purge`, `dsar`,
  Art. 30 `ropa`, manual `review` queue.
- **Efficiency core:** concurrent multi-region ingest, batched writes,
  paginated-source factory, resumable/incremental crawl cursors; JSON
  `directory` and HTML `htmldir` connectors. (Full detail in git history.)

### Next

M1b — NAV verification connector (headcount / debt-free flag / execution-risk
signals), or financial fields for the e-beszámoló record, built via the
paginated-source factory.
