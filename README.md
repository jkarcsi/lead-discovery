# Lead Discovery

A fast, reliable **scraping engine** that gathers Hungarian business data from
the best available sources into one categorized, deduplicated database — keyed
to Procura's taxonomy (category × region) so leads slot straight into matching.

The design goal is **collection efficiency**: maximize throughput and coverage,
minimize wasted round-trips, and keep crawls resilient and idempotent. See
[`docs/SCOPE.md`](docs/SCOPE.md).

> **Scope.** This codebase does collection only. The legality of acquiring and
> using the data is handled separately by the operator — it is not built here
> and is not a blocker. Tunable rate-limits, backoff, and an identified
> User-Agent are kept as *throughput* features (they avoid IP bans), not
> compliance machinery.

## How it's built for throughput

- **Concurrent fetch.** Regions/sources are fetched in parallel
  (`mapWithConcurrency`, `FETCH_CONCURRENCY`); the network is the bottleneck.
- **Batched writes.** A whole batch is persisted in a few queries — load
  suppression once, plan/dedupe in memory, one bulk `findMany`, `createMany` for
  new leads, a single transaction for updates, one `createMany` for audit —
  instead of ~3 round-trips per record.
- **Resilient.** Retries with exponential backoff; an in-run response cache; one
  failing region/source never aborts the batch (`failedRegions` is reported).
- **Idempotent.** Re-running merges on the dedupe key (VAT → domain →
  name+region) rather than duplicating.

## Status

**Phase 1 (collection MVP) is complete and green.**

- Domain model (`prisma/schema.prisma`): `Lead`, `Suppression`, `AuditEvent`
- Procura-aligned taxonomy (`src/taxonomy.ts`) — identical category/region ids
- Pure libs: `normalize`, `categorize`, `dedupe`, `quality`, `concurrency`,
  `ingestPlan` (all I/O-free + unit-tested)
- Resilient `fetcher` (retries + backoff + in-run cache, tunable throttle)
- Connectors: OSM Overpass (all 20 regions); a generic paginated JSON
  `directory` connector (concurrent page fetch); EU VIES `verify` enrichment.
  Overlapping businesses merge across sources on the dedupe key.
- Pipeline: concurrent multi-region `ingest` → batched `store`
- Operator CLI: `collect` / `verify` / `review` / `list` / `stats` / `suppress`
  / `dsar` / `ropa` / `purge`

Roadmap and run history: `ROUTINE_PROMPT.md`.

## Quickstart

```bash
npm install
cp .env.example .env
npx prisma db push
npm test
npm run cli -- collect --source overpass  --region budapest       # one region (fixture)
npm run cli -- collect --source directory --region budapest       # paginated JSON source
npm run cli -- collect --source overpass  --region budapest,pest  # several, concurrent
npm run cli -- collect --source overpass  --region all --live     # full-country live crawl
npm run cli -- stats
```

Without `--live`, the Overpass connector reads `src/connectors/fixtures/`, so
the pipeline runs fully offline. `--live` hits the public Overpass API.

## Tuning (env)

`FETCH_CONCURRENCY` (parallel fetches), `MIN_REQUEST_INTERVAL_MS` (per-host gap,
0 to disable), `FETCH_MAX_RETRIES` / `FETCH_BACKOFF_BASE_MS`, `FETCH_CACHE`,
`WRITE_BATCH_SIZE`, `RESPECT_ROBOTS`. See `src/config.ts` and `.env.example`.

## Architecture

```
sources → connectors → normalize → categorize → dedupe (in-memory plan)
        → batched store (createMany / txn) → Lead DB (SQLite dev / Postgres prod)
        → export to Procura for matching
```

Stack: Node + TypeScript + Prisma. The taxonomy and categorization mirror
Procura so leads slot straight into its matching.

## License

Proprietary — see `LICENSE`. OSM-derived data is ODbL (© OpenStreetMap
contributors).
