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
| 8 | OpenCorporates | Aggregator / normalization | ✅ connector + reg-number dedupe |
| 9 | Google Places API | Contact enrichment (official API) | ✅ `places` step |
| 10 | Website contact pages | Email / phone enrichment | ✅ `enrich` step |
| 11 | Aranyoldalak / Telefonkönyv | Listings | ◻ generic paginated connector exists |
| 12 | EVNY (sole traders) | Sole-trader coverage | ✅ `evny` (flag-gated) |
| 13 | Website text (own pages) | **Primary** categorize/contact source | ✅ `enrich` (text→category) + `ai-categorize` (Haiku) |

> **Wider product context.** This collection engine feeds a larger plan —
> categorized leads → RFQ matching → compliant cold invites → registration (the
> growth loop). That design (legal basis, the cold-invite loop, the AI-path
> rationale) lives in
> [`docs/lead-discovery-plan-in-procurement-network.md`](docs/lead-discovery-plan-in-procurement-network.md);
> its §4 Tier-2 and the AI categorization design are realized here (see
> **AI-assisted categorization** below). Outreach and its legal gating are out of
> scope for this repo — collection only.

## Milestones

- ✅ **M1 — Collection MVP:** schema, taxonomy, pure libraries, resilient fetcher,
  Overpass connector (all 20 regions), batched concurrent ingest, operator CLI.
- 🟡 **M1a — Registry backbone:** e-beszámoló connector (master data + registration
  number + TEÁOR, enriches existing leads by VAT). Remaining: financial fields.
- 🟡 **M1b — Tax verification:** ✅ NAV `nav` step (tax status, debt-free flag,
  headcount, risk reasons). Remaining: a VIES batch driver / scheduling.
- ✅ **M1c — Procurement signal:** `kozbeszerzes` connector (award winners =
  active suppliers) with CPV → taxonomy mapping.
- ✅ **M1d — Classification & cross-check:** TEÁOR→taxonomy mapping; MKIK chamber
  connector; OpenCorporates connector + registration-number dedupe tier.
- ✅ **M2 — Tier-2 enrichment:** contact-page `enrich` (email/phone from sites),
  Google `places` enrichment (phone/website/address), quality-scoring refinement
  (registration-number bonus).
- ✅ **M2s — Sole traders (EVNY):** flag-gated `evny` connector; records always
  flagged personal data; `EVNY_ENABLED=true` required.
- ✅ **M3 — Scale & operate:** `refresh` (collect all sources + enrich in one
  command), `report` (coverage/enrichment dashboard), `export` (NDJSON to Procura).
- ✅ **M4 — Website-text categorization:** `enrich` re-categorizes from a lead's
  own page text; `ai-categorize` (Claude Haiku) classifies what the rules still
  miss. The plan doc's §4 Tier-2 ("website as a primary source") realized here.

**Operator utilities** (shipped, maintained but not the focus): `verify` (VIES),
`review` (manual approve/reject queue), `suppress`/`purge` (do-not-collect +
retention), `dsar` (access/erasure), `ropa` (generated Art. 30 record).

## AI-assisted categorization (the plan's §9.1, realized)

Most discovered businesses don't carry a TEÁOR/CPV code and their name/OSM tags
rarely contain a category keyword — so the rule-based categorizer leaves them
empty even when their own website states plainly what they do. The fix has two
tiers, both free of any third-party platform:

1. **Rules over website text (`enrich`).** The contact-page fetch also extracts a
   bounded "what we do" signal (title/meta/headings) into `classificationText`
   and unions any keyword matches — free, no API.
2. **AI over the leftovers (`ai-categorize`).** For leads still empty but with
   website text, Claude **Haiku 4.5** classifies the text into the taxonomy. The
   cheapest defensible AI path:
   - **Message Batches API** — async, 50% off, sized for thousands of leads.
   - **Structured outputs** constrained to the taxonomy enum (the model cannot
     invent a category); a stable, cacheable system-prompt prefix.
   - **Computed once** — the decision is stored on the lead (`aiCheckedAt`,
     `aiCategories`, `aiConfidence`); re-runs skip already-processed leads.
   - **Confidence-gated** — high-confidence picks are applied to `categories`;
     **low-confidence picks are recorded for manual `review` and never
     auto-applied**, so they can't drive cold outreach.

Pure logic (`lib/aiCategorize.ts`: prompt, schema, parsing) is I/O-free and
unit-tested; the client (`connectors/aiClient.ts`) runs offline from a fixture so
the whole pipeline stays key-free in tests. Live mode needs `ANTHROPIC_API_KEY`.

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
src/connectors/        overpass, directory, htmldir, ebeszamolo, … + aiClient
                       (Claude Haiku batch) + paginated.ts factory + fixtures
src/pipeline/          ingest (concurrent) → store (batched); enrich, places,
                       verify, nav, aiCategorize, recategorize, review, purge, dsar
src/cli.ts             operator CLI
tests/                 vitest unit tests
docs/OPERATING.md      operator runbook (live run order, command reference)
docs/SCOPE.md          scope + efficiency tooling
docs/ROPA.md           generated processing record
```

## Development workflow

1. Read this plan (esp. the progress log) and `docs/SCOPE.md`.
2. Pick the next open roadmap/milestone item (M1–M3 are done; see **Next** —
   real live endpoints/credentials, scheduled refresh), biasing toward throughput
   and coverage.
3. Implement with tests: pure logic in `src/lib/*`, side effects in
   `src/pipeline/*` and `src/connectors/*` (new sources via the paginated factory).
4. Verify green: `npm test`, `npm run build`, an offline CLI smoke.
5. Commit with a clear message, push to the working branch, fast-forward `main`.
6. Append a dated entry to the progress log.

## Progress log (newest first)

### 2026-06-17 (later)

- **Company-registry licence gate (e-cegjegyzek).** Investigated bulk access to
  e-cegjegyzek.hu: no robots.txt, JS-rendered, and the Céginformációs Szolgálat
  ToS **explicitly forbids automated/bulk access (data scraping)** and AI/ML
  training without a usage agreement; the free lookup is CAPTCHA-gated. So bulk
  data is legitimate only via a **contract** with the Céginformációs Szolgálat or
  a **licensed API** (cegadatapi.hu / OPTEN). Fix: added a `licence` gate to the
  paginated factory — the `ebeszamolo` connector now refuses live collection
  unless `EBESZAMOLO_LICENSED=true` and a real `EBESZAMOLO_URL` are set, failing
  fast with a message that points at the official channels. We never bypass the
  CAPTCHA. Default endpoint is now a placeholder. Tests + .env + OPERATING
  updated. 152 tests green.

### 2026-06-17

- **M4 — AI categorization (plan §4 Tier-2 / §9.1).** Added `ai-categorize`:
  Claude **Haiku 4.5** classifies the website text of leads the rules couldn't,
  via the **Batches API** with **structured outputs** locked to the taxonomy
  enum and a cacheable prompt prefix. The decision is stored on the lead
  (`aiCheckedAt` / `aiCategories` / `aiConfidence`) so it runs once; high-
  confidence picks apply, low-confidence ones go to manual review and never
  auto-apply. Pure logic (`lib/aiCategorize.ts`) + offline fixture client
  (`connectors/aiClient.ts`) keep tests key-free; `refresh` runs it last and
  skips it on a keyless live run. Integrated the separate plan doc's relevant
  parts into this plan (Tier-2 promotion, growth-loop context, AI design). New
  dep `@anthropic-ai/sdk`. 150 tests green. Smoke: a fire-safety site with no
  keyword in its name was applied as `fire-safety`; a low-confidence pick was
  recorded for review without being applied.

### 2026-06-15

- **Live-mode hardening (reliability).** Fixed the root cause of the Overpass
  `429`/`504` floods under `--region all --live`: the per-host throttle wrote its
  timestamp *after* sleeping, so concurrent requests all read the same stale time
  and fired together — the gap was never enforced. It now reserves each host slot
  synchronously, so requests are genuinely spaced by `MIN_REQUEST_INTERVAL_MS`
  regardless of `FETCH_CONCURRENCY`. Added: `Retry-After` is honored on `429`/`5xx`;
  the Overpass connector falls back across mirrors (`OVERPASS_MIRRORS`) so a single
  endpoint's rate-limit/timeout no longer drops a region; live fetches against a
  reserved placeholder TLD (`directory`/`htmldir` defaults) now fail fast with a
  message naming the env var to set, instead of an opaque "fetch failed". Prisma
  client now generates for Windows + Linux (repo is developed from both). New
  `tests/fetcher.test.ts` locks the throttle serialization and placeholder guard.
  135 tests green.
- **`enrich` throughput + observability.** Added a per-request `FETCH_TIMEOUT_MS`
  (default 15s) so a single hung website can't stall a run; made `enrich` fetch
  websites in concurrent windows (`FETCH_CONCURRENCY`) while keeping DB writes
  sequential (SQLite is single-writer); added an `onProgress` callback the CLI
  uses to print `[done/total] … ~Ns left` progress (~20 lines) on long live runs.
  Documented the full operating flow in `docs/OPERATING.md`.

### 2026-06-14

- **M3 — scale & operate:** `refresh` (orchestrates collect across all non-gated
  sources + all enrichment steps, resuming cursors), `report` (pure
  `buildCoverageReport` → totals / by-source / quality buckets / enrichment
  coverage), `export` (pure `toProcuraRecord` → NDJSON, excludes rejected +
  personal data, quality filter). Smoke: one `refresh` built 21 deduped leads
  across 7 sources + enriched; export wrote 19 NDJSON records. **All milestones
  M1–M3 complete.** 132 tests green.
- **M2s — sole traders (EVNY):** flag-gated `evny` connector (`lib/evnyParse.ts`
  + gate wrapper on the factory). Collection throws unless `EVNY_ENABLED=true`;
  records are always personal data. Added a `RawBusiness.isPersonalData` hint so
  a source can assert it. 128 tests green.
- **M2 — Tier-2 enrichment:** `enrich` (contact-page email/phone via a pure
  `extractContacts` + a fixture/live `contactPage` client) and `places` (Google
  Places phone/website/address via a pure `parsePlace` + fixture/live client),
  both filling gaps only, recomputing quality, stamping `*CheckedAt`. Quality
  scorer now credits a registration number. Shared `lib/html.ts` (decode/strip)
  extracted. 126 tests green.
- **M1d — normalization/dedupe (OpenCorporates):** added a **registration-number
  dedupe tier** (VAT → reg.number → domain → name+region) so registry/aggregator
  records sharing a cégjegyzékszám merge even without a VAT or across name
  spelling variations. Added the `opencorporates` connector (reuses the registry
  parser); smoke merged "Budai Tűzvédelmi Kft." with its full legal-name variant
  by registration number and enriched it. **M1d complete.** 121 tests green.
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

All planned milestones (M1–M3) are complete, and the live path is hardened
(throttle, mirror fallback, clear endpoint errors). Future work: wire real
`--live` endpoints/credentials behind the `directory`/`htmldir`/registry clients,
scheduled `refresh` (cron), and embeddings-assisted categorization when an API
key is available.
