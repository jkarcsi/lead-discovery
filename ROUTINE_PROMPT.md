# Procura Lead Discovery — Recurring Development Routine

You are Claude Code, working autonomously on **Procura Lead Discovery**, a
service that *legally* builds a categorized database of Hungarian businesses so
a buyer's Procura RFQ can also reach relevant **not-yet-registered** suppliers
(the growth loop). This file is your standing brief: **read it at the start of
every run, follow it, and keep it up to date** — especially the phase checklist
and the **status log at the bottom**.

Repo: `jkarcsi/lead-discovery` (GitHub) · Dev branch: the session's designated
`claude/intelligent-allen-*` branch (currently `claude/intelligent-allen-8jgyss`;
the suffix changes per session — push to whichever branch this run was given).
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
- [ ] **Phase 1 cont. — more Tier-1 sources & coverage:** ✅ Overpass area
      mappings now cover Budapest + all 19 counties (derived from taxonomy);
      ✅ VIES VAT verification connector. Remaining: company-registry / NAV
      taxpayer / KSH-TEÁOR / MKIK connectors (ToS/licence permitting);
      embeddings-assisted categorization.
- [ ] **Phase 2 — Enrichment & verification:** ✅ VAT/VIES verification
      (`verify` pipeline + CLI, stamps `lastVerifiedAt`/`vatValid`, re-scores
      quality). Remaining: Tier-2 public contact pages (robots/ToS-gated),
      quality scoring refinements, a manual review queue / admin surface.
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
2. **Branch discipline.** Develop on `claude/intelligent-allen-39ybva`. Push
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
src/lib/vies.ts          pure VIES request-shaping + response-parsing (tested)
src/lib/leadRow.ts       row → LeadInput mapper (shared by ingest + verify)
src/connectors/          source connectors (overpass, all-county) + offline fixtures
src/pipeline/            transform (pure) + ingest + verify (VAT validation)
src/cli.ts               operator CLI (collect / verify / list / stats / suppress)
tests/                   vitest unit tests for the pure libs
docs/LEGAL.md            the compliance gate
```

---

## Status log (newest first)

### 2026-06-14 — run 2 (countrywide coverage + VAT verification)

- **Context:** Phase 1 was complete & green from run 1. Took the documented next
  step — widen Tier-1 coverage and add VAT verification — as one coherent
  increment.
- **Shipped:**
  - **Overpass countrywide:** replaced the 2-region `AREA_QUERY` map with a pure
    `areaSelector(regionId)` derived from the shared taxonomy, so `--live` now
    covers Budapest + all 19 counties (admin_level 6) with zero drift from
    Procura's region ids.
  - **VAT/VIES verification (Phase 2 enrichment, no outreach):**
    - `lib/vies.ts` — pure `huVatCore` / `viesRequestBody` / `parseViesResult`
      (tolerant of withheld `---`/empty fields).
    - `pipeline/verify.ts` — selects leads with a VAT number that are unverified
      or stale (`verifyTtlDays`, default 90), validates them (offline = local HU
      check digit; `--live` = EU VIES REST), stamps `lastVerifiedAt` + new
      `vatValid` column, re-scores quality, writes a `VERIFIED` audit row.
    - `quality.ts` — verified VAT now earns +20 (vs +15 checksum-only); a
      confirmed-invalid VAT earns 0.
    - Schema: added `Lead.vatValid Boolean?`. `fetcher.politePost` gained an
      optional content-type (JSON for VIES). Extracted `lib/leadRow.ts`
      (row→LeadInput) shared by ingest + verify.
    - CLI: `verify [--live] [--limit N] [--stale-days N]`; `stats` now shows
      "VAT verified / valid".
  - LEGAL.md: VIES added as an Implemented Tier-1 source (validation-only, no
    data stored from VIES beyond the result); README + layout refreshed.
  - Tests: +13 (vies, overpass `areaSelector`/`parseOverpass`, quality bonus) →
    **40/40 green**.
- **Verified:** `npm test` 40/40; `npm run build` (tsc) clean; offline smoke —
  collect budapest (7 created, 1 merged), `verify` checked 1 (the one VAT-bearing
  lead) valid via checksum, re-run idempotent (0), `--stale-days 0` forces a
  re-check (1), `stats` shows "VAT verified: 1 (valid: 1)".
- **Next step:** add the **retention/purge job** (the open gap: a lead stored
  *before* its suppression is skipped on re-ingest but never purged) + a DSAR
  (access/erasure) CLI; then a second Tier-1 connector (KSH-TEÁOR activity-code
  mapping, or NAV taxpayer DB — check ToS). Outreach stays gated.

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
