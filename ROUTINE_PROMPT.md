# Procura Lead Discovery — Recurring Development Routine

You are Claude Code, working autonomously on **Procura Lead Discovery**, a
service that *legally* builds a categorized database of Hungarian businesses so
a buyer's Procura RFQ can also reach relevant **not-yet-registered** suppliers
(the growth loop). This file is your standing brief: **read it at the start of
every run, follow it, and keep it up to date** — especially the phase checklist
and the **status log at the bottom**.

Repo: `jkarcsi/lead-discovery` (GitHub) · Dev branch: `claude/intelligent-allen-fqxx72`
Strategy doc: `docs/lead-discovery-plan.md` in the `jkarcsi/procurement-network` repo.

## Mission

Ship the collection + compliance backbone, then (only after the legal gate) the
cold-invite loop into Procura. Every run must move the project measurably
forward and leave the repo **green** (`npm test` + `npm run build` passing) and
**pushed** to the dev branch.

## The legal gate (READ FIRST — it constrains everything)

Collecting business data and sending unsolicited B2B inquiries touches GDPR,
Grt., Eker. tv. and ePrivacy (authority: NAIH). See `docs/LEGAL.md`.

- **No outreach ships** before counsel signs off the LIA/DPIA, privacy notice,
  and suppression/opt-out design. `OUTREACH_ENABLED` stays `false`; there is
  **no outreach command** until then.
- **Collection is Tier-1 open data only** (currently OSM/Overpass, ODbL). Honor
  robots.txt + ToS, identified User-Agent, per-domain rate limits. No auth /
  paywall bypass, no scraping where an API or open dataset exists.
- **Provenance on every record** (`source`, `sourceUrl`, `sourceLicense`,
  `collectedAt`); `isPersonalData` flagged for sole traders / named contacts.
- **Suppression is sacred**: checked at ingest now, at send later; opt-out and
  bounces suppress permanently and globally.

## Phase checklist (the finish line)

- [x] **Phase 1 — Open-data MVP (collection):** schema (`Lead`/`Suppression`/
      `AuditEvent`), Procura-aligned taxonomy, pure libs (`normalize`,
      `categorize`, `dedupe`, `quality`), polite `fetcher` (robots + rate
      limit), `overpass` connector (fixture + live), `ingest` pipeline
      (transform → suppression → dedupe-merge → store + audit), `suppression`
      + `audit` compliance, operator CLI, unit tests. **Done & green.**
- [ ] **Phase 1 cont. — more Tier-1 sources & coverage:** widen Overpass area
      mappings to all 19 counties; add company-registry / NAV-VIES / KSH-TEÁOR /
      MKIK connectors (ToS/licence permitting); embeddings-assisted categorization.
- [ ] **Phase 2 — Enrichment & verification:** Tier-2 public contact pages
      (robots/ToS-gated), VAT/VIES verification (`lastVerifiedAt`), quality
      scoring refinements, a manual review queue / admin surface.
- [ ] **Retention & DSAR ops:** purge job for never-engaged personal-data leads;
      DSAR (access/erasure/objection) tooling; Art. 30 record artifact.
- [ ] **Phase 3 — Cold-invite loop (GATED on counsel):** export to Procura,
      `RfqInvite source=COLD` + `leadId`, tokenized opt-out endpoint, claim &
      convert lead → SupplierProfile, hard caps, complaint/bounce auto-pause,
      separate sending identity. **Do not build the send path before sign-off.**
- [ ] **Phase 4 — Scale & monitor:** dashboards, alerts, automated suppression;
      widen categories/regions only while opt-out/complaint rates stay low.

## Hard rules

1. **Language split: Hungarian product, English codebase.** Anything a future
   user sees (outreach copy, labels) is Hungarian; identifiers, comments,
   commits, docs, logs, tests are English. (Taxonomy names/keywords are
   Hungarian by design — they mirror Procura and feed matching.)
2. **Branch discipline.** Develop on `claude/intelligent-allen-fqxx72`. Push
   with `git push -u origin <branch>`. Never push to `main`, never open a PR
   unless explicitly asked.
3. **Keep parity with Procura's taxonomy.** `src/taxonomy.ts` category/region
   ids must stay identical to Procura's so leads slot straight into matching.
   If Procura adds a category, mirror it here.
4. **Don't break the build.** `npm test` and `npm run build` (tsc) must pass
   before every push. The pipeline must run **fully offline** via fixtures
   (`--live` is opt-in); pure libs stay I/O-free and unit-tested.
5. **Respect the gate.** Never add an outreach/send path, never enable
   `OUTREACH_ENABLED`, never collect beyond the approved tiers, without the
   documented counsel sign-off. When in doubt, build collection/compliance, not
   outreach.

## Environment & setup (every run)

```bash
npm install                  # node_modules is not persisted between sessions
cp .env.example .env         # if .env is missing
npx prisma generate
npx prisma db push           # SQLite schema sync (dev.db)
npm test                     # pure-lib unit tests — verify you start green
npm run build                # tsc typecheck
npm run cli -- collect --source overpass --region budapest   # offline smoke
npm run cli -- stats
git log --oneline -10        # see where the last run stopped
```

## How to work a run

1. Read this file (esp. the status log) and `docs/LEGAL.md`.
2. Pick the **next unchecked item** in the phase checklist (top-down) unless the
   log says otherwise. Prefer one coherent, shippable increment over many
   half-done ones.
3. Implement with tests. Keep pure logic in `src/lib/*` (I/O-free, tested);
   side-effecting code in `src/pipeline/*`, `src/connectors/*`, `src/cli.ts`.
4. Verify: `npm test` + `npm run build` + an offline CLI smoke, all green.
5. Commit (clear English message) and **push** to the dev branch.
6. **Append a dated entry to the status log below**: what shipped, what you
   verified, and the next step. Update the phase checklist boxes.

## Layout

```
prisma/schema.prisma     Lead / Suppression / AuditEvent
src/taxonomy.ts          Procura-aligned categories + regions (shared ids)
src/lib/                 pure, tested: normalize, categorize, dedupe, quality
                         + side-effecting: fetcher (polite), suppression, audit
src/connectors/          source connectors (overpass) + offline fixtures
src/pipeline/            transform (pure) + ingest (orchestration)
src/cli.ts               operator CLI (collect / list / stats / suppress)
tests/                   vitest unit tests for the pure libs
docs/LEGAL.md            the compliance gate
```

---

## Status log (newest first)

### 2026-06-14 — run 2 (Overpass countrywide coverage)

- **Context:** repo started green (33→ was 27 tests, clean `tsc`, offline CLI
  smoke OK). Fixed a stale branch reference in this file: the dev branch is
  `claude/intelligent-allen-fqxx72` (was `…39ybva`).
- **Shipped (Phase 1 cont. — coverage):** Overpass `--live` now works for every
  region, not just budapest/pest. Replaced the hardcoded 2-entry `AREA_QUERY`
  map with `areaSelector(regionId)`, derived from the shared taxonomy `REGIONS`
  (single source of truth): Budapest → `area["name"="Budapest"]["admin_level"="6"]`,
  counties → `area["name"="<County> vármegye"]["admin_level"="6"]` (suffix added
  only when the taxonomy name lacks it, so "Pest vármegye" isn't doubled).
  Exported `areaSelector` + `buildQuery` for testing.
- **Verified:** `npm test` 33/33 green (+6 new in `tests/overpass.test.ts`,
  covering Budapest, suffix-append, no-double-suffix, all-20-regions sweep,
  unknown-region error, and `buildQuery` shape/limit); `npm run build` clean;
  offline CLI smoke (collect pest → 2 created; `stats` renders region breakdown).
- **Next step:** add a second Tier-1 enrichment connector — NAV/VIES VAT
  verification setting `lastVerifiedAt` on leads with a `vatNumber` (schema
  already has the field? verify, add if missing) — and then the retention/purge
  job for suppressed/never-engaged personal-data leads (the gap from run 1:
  a lead stored before its suppression is skipped on re-ingest but not purged).
  Live countrywide collection still needs fixtures only for offline tests; the
  `--live` path is now unblocked for all counties.

### 2026-06-14 — run 1 (bootstrap)

- **Context:** the dedicated `jkarcsi/lead-discovery` repo became reachable this
  session (it wasn't before — earlier work had been parked in the Procura repo
  under `lead-discovery/`). Imported that foundation into this repo as the
  initial commit, then built out Phase 1.
- **Shipped (Phase 1 complete & green):**
  - Pure libs: `categorize` (taxonomy keyword + accent-fold matching, region
    detection incl. 1xxx→Budapest postcode rule), `dedupe` (VAT→domain→name+region
    key + `mergeLead`), `quality` (0–100 completeness score). `normalize` was
    already present.
  - `lib/fetcher.ts`: polite HTTP (identified UA + contact URL, per-domain
    throttle, robots.txt honored) for any live fetch.
  - `connectors/overpass.ts`: Tier-1 OSM/Overpass connector (ODbL), shared JSON
    parser for fixture + live; offline fixtures for budapest & pest; connector
    registry.
  - `pipeline/transform.ts` (raw→LeadInput, personal-data heuristic) and
    `pipeline/ingest.ts` (transform → suppression check → dedupe-merge upsert →
    Lead store + audit).
  - Compliance: `lib/suppression.ts` (global do-not-contact, checked at ingest)
    and `lib/audit.ts` (COLLECTED/MERGED/SUPPRESSED_SKIP/… trail).
  - `src/cli.ts`: `collect` / `list` / `stats` / `suppress`. No outreach command
    (gate).
  - `docs/LEGAL.md`: the compliance gate written up; README status refreshed.
  - Tests: 27 unit tests across normalize / categorize / dedupe / transform.
- **Verified:** `npm test` 27/27 green; `npm run build` (tsc) clean; offline CLI
  smoke — collect budapest (8 fetched → 7 created, 1 merged on duplicate VAT),
  re-collect idempotent (all merged), pest (2 created), suppress + re-collect
  skips the opted-out lead (1 skipped). `stats`/`list` render category/region
  breakdowns and the ⚠ personal-data flag.
- **Next step:** Phase 1 cont. — extend `AREA_QUERY` in `overpass.ts` to the
  remaining counties (so `--live` works countrywide), and add a second Tier-1
  connector (NAV/VIES VAT verification as an enrichment step, setting
  `lastVerifiedAt`). Then start a retention/purge job for suppressed/never-engaged
  personal-data leads (the one gap noticed: a lead stored *before* its
  suppression is skipped on re-ingest but not yet purged).
