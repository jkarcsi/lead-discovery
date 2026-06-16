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
- **Incremental.** Paginated sources persist a per-(source, region) cursor and
  resume from it, so a re-run fetches only new pages (`--full` to re-scan).

## Status

**Milestones M1–M3 are complete and green** (135 tests). See
[`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) for the milestone log.

- Domain model (`prisma/schema.prisma`): `Lead`, `Suppression`, `AuditEvent`,
  `CrawlState`. Prisma is generated for Windows + Linux (the repo is developed
  from both Windows and WSL).
- Procura-aligned taxonomy (`src/taxonomy.ts`) — identical category/region ids
- Pure libs: `normalize`, `categorize`, `dedupe`, `quality`, `concurrency`,
  `ingestPlan` (all I/O-free + unit-tested)
- Resilient `fetcher` (retries + backoff + in-run cache + a per-host throttle
  that holds under concurrency; honors `Retry-After`)
- Connectors (a paginated-source factory makes adding more cheap): OSM Overpass
  (all 20 regions, with mirror fallback); company registry `ebeszamolo`; a JSON
  `directory`; an HTML `htmldir`; chamber registry `mkik`; aggregator
  `opencorporates`; public procurement `kozbeszerzes` (CPV→taxonomy); sole-trader
  `evny` (flag-gated, personal data). Enrichment: EU VIES `verify`, NAV `nav`,
  website contact pages `enrich`, Google Places `places`. Overlapping businesses
  merge across sources on the dedupe key (VAT → registration number → domain →
  name+region).
- Pipeline: concurrent multi-region `ingest` → batched `store`
- Operator CLI: `collect` / `refresh` (all sources + enrich) / `verify` (VIES) /
  `nav` (tax-status) / `enrich` (contact pages) / `places` (Google Places) /
  `review` / `report` (dashboard) / `export` (NDJSON → Procura) / `list` /
  `stats` / `suppress` / `dsar` / `ropa` / `purge`

### Live mode

A full operating walkthrough — the email-optimized run order, a per-command
reference, the live-source matrix, and how to wire `directory`/`htmldir` — is in
[`docs/OPERATING.md`](docs/OPERATING.md).

`--live` switches a connector from its offline fixtures to the real network.
What that needs per source:

- **`overpass`** works live out of the box — it queries the public Overpass API
  and falls back across mirrors (`OVERPASS_MIRRORS`) when one rate-limits (`429`)
  or times out (`504`). The per-host throttle (`MIN_REQUEST_INTERVAL_MS`) spaces
  requests so a full-country crawl doesn't trip rate limits. Note the public
  `overpass-api.de` is IPv6-only; a host without IPv6 routing should rely on the
  IPv4 mirrors or set `OVERPASS_URL` to one.
- **`directory` / `htmldir`** ship with placeholder endpoints
  (`*.test`) and only run live once you point `DIRECTORY_URL` / `HTML_DIRECTORY_URL`
  at a real listing. Run them live without that and they fail fast with a message
  saying exactly which env var to set (rather than an opaque "fetch failed").
- The registry/enrichment steps (`ebeszamolo`, `nav`, `places`, …) default to
  the official endpoints; some need credentials/keys before they return data.

Roadmap and progress: [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md).

## Quickstart

```bash
npm install
cp .env.example .env
npx prisma db push
npm test
npm run cli -- collect --source overpass  --region budapest       # one region (fixture)
npm run cli -- collect --source directory --region budapest       # paginated JSON source
npm run cli -- collect --source htmldir   --region budapest       # paginated HTML source
npm run cli -- collect --source overpass  --region budapest,pest  # several, concurrent
npm run cli -- collect --source overpass  --region all --live     # full-country live crawl
npm run cli -- ai-categorize --dry-run                            # size the AI residual (no key)
npm run cli -- ai-categorize --live                               # classify the residual (needs a key)
npm run cli -- stats
```

Without `--live`, every connector reads `src/connectors/fixtures/`, so the
pipeline runs fully offline. `--live` hits real endpoints (see **Live mode**).

## AI categorization of undetermined leads

Rule-based categorization (`src/lib/categorize.ts`) places most leads for free
and is the only path that runs by default — it works **without** any API key.
For the residual the rules can't place (`categories == []`), `ai-categorize`
asks Claude to classify them from their name, listing, and a little scraped
website text, the cheapest way possible (IMPLEMENTATION_PLAN §9.1):

- **Claude Haiku 4.5** — the cheapest model, ample for short-text classification.
- **Message Batches API** — 50% off; categorization is an offline, non-latency-
  sensitive job, so the whole residual goes in one batch.
- **Prompt caching** — the taxonomy + instructions + schema are a stable prefix.
- **Structured outputs** — the response is constrained to the taxonomy enum, so
  results are always in-taxonomy (no free-text parsing).
- **Computed once and stored** — the decision (categories, confidence, model,
  prompt version) is persisted on the Lead; re-run only with `--revalidate`
  (e.g. after a prompt/taxonomy version bump). Low-confidence decisions are
  recorded but held for **manual review** — never written to `categories` for
  auto-outreach.

Set `ANTHROPIC_API_KEY` to enable it; with no key the command is a clean no-op
and the leads stay with the rules / manual review.

## Tuning (env)

`FETCH_CONCURRENCY` (parallel fetches), `MIN_REQUEST_INTERVAL_MS` (per-host gap,
0 to disable), `FETCH_MAX_RETRIES` / `FETCH_BACKOFF_BASE_MS`, `FETCH_CACHE`,
`WRITE_BATCH_SIZE`, `RESPECT_ROBOTS`, `OVERPASS_MIRRORS` (comma-separated
fallback endpoints), `OVERPASS_URL` / `DIRECTORY_URL` / `HTML_DIRECTORY_URL`
(live source endpoints). AI categorization: `ANTHROPIC_API_KEY` (enables it),
`AI_CATEGORIZE_MODEL`, `AI_CONFIDENCE_THRESHOLD`, `AI_BATCH_MAX_LEADS`. See
`src/config.ts` and `.env.example`.

## Architecture

```
sources → connectors → normalize → categorize → dedupe (in-memory plan)
        → batched store (createMany / txn) → Lead DB (SQLite dev / Postgres prod)
        → ai-categorize (Haiku batch, the rule-residual only) → export to Procura
```

Stack: Node + TypeScript + Prisma. The taxonomy and categorization mirror
Procura so leads slot straight into its matching.

## License

Proprietary — see `LICENSE`. OSM-derived data is ODbL (© OpenStreetMap
contributors).
