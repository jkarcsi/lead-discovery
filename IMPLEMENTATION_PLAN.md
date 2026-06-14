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
| 3 | NAV databases | Verification / risk signals | ✅ `nav` step |
| 4 | VIES (EU VAT) | VAT validation | ✅ `verify` step |
| 5 | Közbeszerzés (EKR / TED) | Active-supplier proof | ✅ `kozbeszerzes` (CPV→taxonomy) |
| 6 | KSH-TEÁOR | Classification reference | ✅ TEÁOR→taxonomy mapping |
| 7 | MKIK chamber | Coverage cross-check | ✅ `mkik` connector |
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
- 🟡 **M1b — Tax verification:** ✅ NAV `nav` step (tax status, debt-free flag,
  headcount, risk reasons). Remaining: a VIES batch driver / scheduling.
- ✅ **M1c — Procurement signal:** `kozbeszerzes` connector (award winners =
  active suppliers) with CPV → taxonomy mapping.
- 🟡 **M1d — Classification & cross-check:** ✅ TEÁOR→taxonomy mapping; ✅ MKIK
  chamber connector (coverage cross-check). Remaining: OpenCorporates dedupe.
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

- **M1d — coverage cross-check:** added the `mkik` chamber connector on the
  paginated factory, reusing `parseCompanyRegistryPage` (no new parser). Confirms
  companies by VAT against other sources and widens coverage. 6 connectors total.
- **M1d — classification:** added `lib/teaor.ts` (TEÁOR'08 → taxonomy) and a
  shared `lib/prefixMap.ts` helper (CPV + TEÁOR both use it). The e-beszámoló
  registry now authoritatively categorizes companies from their TEÁOR code (e.g.
  8425 → fire-safety, 6203 → it-support), not just keywords. 116 tests green.
- **M1c — procurement signal:** added the `kozbeszerzes` connector (paginated
  factory) + `lib/procurementParse.ts` + `lib/cpv.ts` (CPV → taxonomy). Award
  winners are discovered as active suppliers and **authoritatively categorized
  from CPV codes** — even with no descriptive text. `RawBusiness.categories` hint
  added; `transform` unions connector-provided categories with keyword-derived
  ones. 111 tests green.
- **M1b — tax verification:** added the NAV `nav` enrichment step
  (`connectors/nav.ts` client + `lib/navParse.ts` pure parser/risk flags +
  `pipeline/navVerify.ts`). For each VAT-bearing lead it records tax status
  (active/suspended/cancelled), debt-free flag (köztartozásmentes), and headcount
  onto the lead, with a `NAV_CHECKED` audit; `stats` shows a NAV summary. New
  `Lead` fields: `taxStatus`, `debtFree`, `employeeCount`, `navCheckedAt`.
  104 tests green.
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

M1d remainder — OpenCorporates normalization/dedupe; then M2 Tier-2 enrichment
(Google Places via official API, polite contact-page crawl, quality refinements).
