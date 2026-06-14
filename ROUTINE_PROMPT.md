# Lead Discovery — Efficient Scraping: Implementation Plan & Routine

You are Claude Code, working autonomously on **Lead Discovery**: a fast,
reliable scraping engine that gathers Hungarian business data from the best
available sources into one categorized, deduplicated database (aligned to
Procura's taxonomy so leads slot straight into matching). Read this file at the
start of every run, follow it, and keep it up to date — especially the **status
log at the bottom**.

Repo: `jkarcsi/lead-discovery` · Dev branch: `claude/intelligent-allen-xv65ne`
(integration branch `main`, kept fast-forwarded).

## Mission

**Efficiency is the first priority.** Build fast, broad, robust scraping:
maximize throughput and coverage (more sources, more records, fewer wasted
round-trips) while staying resilient (retries, partial-failure tolerance,
idempotent re-runs). Every run must move the project measurably forward and
leave the repo **green** (`npm test` + `npm run build`) and **pushed**.

> **Scope note.** This project's job is *collection efficiency only*. The
> legality of acquiring and using the data is handled **separately by the
> operator** (legal review, a different project) — it is **not** a blocker here
> and we do not build consent/gate machinery. Keep the technically-prudent
> defaults that make scraping work better at scale (identified User-Agent,
> tunable per-host rate limits, retries/backoff) because they prevent IP bans and
> throttling — they're throughput features. Keep `source`/`sourceUrl`/
> `sourceLicense`/`collectedAt` provenance because it's good data hygiene and
> aids dedupe. Do **not** build auth/paywall/CAPTCHA bypass or ban-evasion. See
> `docs/SCOPE.md`.

## Efficiency principles (the spirit)

- **Few round-trips.** Batch DB reads/writes; load lookups once; `createMany` /
  transactions, not per-record awaits.
- **Parallel I/O.** Fetch sources/pages concurrently (`mapWithConcurrency`,
  `config.fetchConcurrency`); the network is the bottleneck.
- **Resilient.** One bad source/region/page never aborts the batch; retry
  transient failures with backoff; cache identical fetches within a run.
- **Idempotent + incremental.** Re-runs merge on the dedupe key and resume
  paginated sources from a saved cursor (only fetch new pages).
- **Cheap to add a source.** New sources go through `connectors/paginated.ts`
  (URL builder + fixture path + pure page parser).

## Data-source coverage roadmap (best sources, build top-down)

| # | Source | Role | Status |
|---|--------|------|--------|
| 1 | OSM/Overpass | Discovery POIs | ✅ all 20 regions |
| 2 | e-beszámoló / Céginformációs Szolgálat | Company master + reg.no + TEÁOR | ✅ connector |
| 3 | NAV databases | Verification / risk signals | ⬜ next |
| 4 | VIES (EU VAT) | VAT validation | ✅ `verify` step |
| 5 | Közbeszerzés (EKR/TED) | Active-supplier proof | ⬜ |
| 6 | KSH-TEÁOR | Classification reference | ⬜ |
| 7 | MKIK chamber | Coverage cross-check | ⬜ |
| 8 | OpenCorporates | Aggregator/normalization | ⬜ |
| 9 | Google Places API | Contact enrichment | ⬜ (official API only) |
| 10 | Website contact pages | Email/phone enrichment | ◻ `htmldir` scraper exists |
| 11 | Aranyoldalak/Telefonkönyv | Listings | ◻ generic paginated connector exists |
| 12 | EVNY (sole traders) | Sole-trader coverage | ⬜ flag-gated, last |

## Phase checklist

- ✅ **Phase 1 — Collection MVP:** schema, taxonomy, pure libs, resilient fetcher,
  overpass connector (all 20 regions), batched concurrent ingest, CLI, tests.
- 🟡 **Phase 1a — Registry backbone:** ✅ e-beszámoló connector (master + reg.no +
  TEÁOR, enriches by VAT). Next: financial fields.
- ⬜ **Phase 1b — NAV verification:** headcount / debt-free flag / execution-risk
  signals; VIES batch driver (`verify` exists).
- ⬜ **Phase 1c — Procurement signal:** EKR / Közbeszerzési Értesítő / TED, CPV→taxonomy.
- ⬜ **Phase 1d — Classification & cross-check:** KSH-TEÁOR, MKIK, OpenCorporates dedupe.
- ⬜ **Phase 2 — Tier-2 enrichment:** Google Places (official API) + polite crawl,
  quality refinements.
- ⬜ **Phase 2s — Sole traders (EVNY):** behind an explicit flag, last.
- 🟡 **Operator utilities (not a focus, keep working):** `verify`, `review`,
  `suppress`/`purge`, `dsar`, `ropa` — already shipped.
- ⬜ **Phase 4 — Scale & monitor:** throughput dashboards, scheduled incremental
  refresh, export to Procura.

## Hard rules

1. **Language split:** Hungarian user-facing, English codebase.
2. **Branch discipline:** develop on the dev branch; reach `main` only by
   fast-forward of the dev branch. No PR unless asked.
3. **Taxonomy parity:** category/region ids match Procura's.
4. **Build discipline:** `npm test` + `npm run build` pass before every push;
   pipeline fully offline via fixtures (`--live` opt-in); pure libs I/O-free + tested.
5. **Optimize for throughput, don't fight protections.** Tunable rate-limit/
   backoff/UA stay (they avoid bans = more throughput). No auth/paywall/CAPTCHA
   bypass or ban-evasion. Legality of use is the operator's separate concern.
6. **Don't discard work.** Keep every connector/utility; reframe, don't delete.

## Environment setup
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

## How to work a run
1. Read this file (esp. the status log) and `docs/SCOPE.md`.
2. Pick the next unchecked roadmap/phase item (default: **Phase 1b NAV
   connector**), biasing toward throughput/coverage.
3. Implement with tests; pure logic in `src/lib/*`, side-effects in
   `src/pipeline/*` and `src/connectors/*` (new sources via the paginated factory).
4. Verify green: `npm test`, `npm run build`, an offline CLI smoke.
5. Commit, push to the dev branch, fast-forward `main`.
6. Append a dated entry to the status log.

## Repo structure
- `prisma/schema.prisma` — Lead / Suppression / AuditEvent / CrawlState
- `src/taxonomy.ts` — Procura-aligned categories + regions
- `src/lib/` — pure, tested (parsers, concurrency, paginate, dedupe, quality, …) + side-effecting fetcher
- `src/connectors/` — overpass, directory, htmldir, ebeszamolo + `paginated.ts` factory + fixtures
- `src/pipeline/` — ingest (concurrent) → store (batched), verify, review, purge, dsar, crawlState
- `src/cli.ts` — operator CLI
- `tests/` — vitest unit tests
- `docs/SCOPE.md` — scope + efficiency tooling; `docs/ROPA.md` — generated record

## Status log (newest first)

### 2026-06-14 — run 13 (framing finalized: efficiency-first)

- **Operator decision:** legal-first approach is rejected; **efficiency is the
  first priority**, and **no work is discarded**. Reframed this brief back to
  efficiency-first (kept the useful 12-source coverage roadmap from the plan as
  build targets). Removed `docs/LEGAL.md` (re-added in run 12); `docs/SCOPE.md`
  leads. **No code/connectors/tests removed** — all 97 tests still green.
- **Next:** Phase 1b — NAV verification connector (or e-beszámoló financial
  fields), via the paginated-source factory.

### 2026-06-14 — run 12 (Phase 1a e-beszámoló registry connector)

- Shipped `lib/companyRegistryParse.ts` (pure) + `connectors/ebeszamolo.ts` on
  the paginated factory — company master data with cégjegyzékszám
  (registrationNumber) + TEÁOR. Registry records merge into existing leads by
  VAT, enriching them with authoritative identity. Smoke: Tiszta Iroda gained
  `registrationNumber 01-09-111111`; `Connectors: overpass, directory, htmldir,
  ebeszamolo`. 97 tests green.

(Earlier runs 1–11: countrywide Overpass, VIES verify, retention/purge, DSAR,
Art. 30 ROPA, manual review queue, efficiency rewrite — concurrency + batched
writes + paginated-source factory + resume cursors — directory/htmldir
connectors. Full detail in git history.)
