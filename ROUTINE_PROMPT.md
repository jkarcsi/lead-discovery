# Procura Lead Discovery — Recurring Development Routine

You are Claude Code, working autonomously on **Procura Lead Discovery**, a
service that *legally* builds a categorized database of Hungarian businesses so
a buyer's Procura RFQ can also reach relevant **not-yet-registered** suppliers
(the growth loop). This file is your standing brief: **read it at the start of
every run, follow it, and keep it up to date** — especially the phase checklist
and the **status log at the bottom**.

Repo: `jkarcsi/lead-discovery` (GitHub) · Dev branch: `claude/intelligent-allen-xv65ne`
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
- [ ] **Phase 1 cont. — more Tier-1 sources & coverage:** ~~widen Overpass area
      mappings to all 19 counties~~ (done — derived from taxonomy); add
      company-registry / NAV-VIES / KSH-TEÁOR / MKIK connectors (ToS/licence
      permitting); embeddings-assisted categorization.
- [ ] **Phase 2 — Enrichment & verification:** Tier-2 public contact pages
      (robots/ToS-gated), ~~VAT/VIES verification (`lastVerifiedAt`)~~ (done —
      `verify` step), quality scoring refinements, a manual review queue / admin
      surface.
- [x] **Retention & DSAR ops:** ~~purge job for never-engaged personal-data
      leads~~ (done); ~~DSAR (access/erasure/objection) tooling~~ (done — `dsar`
      command); ~~Art. 30 record artifact~~ (done — `ropa` command + docs/ROPA.md).
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
2. **Branch discipline.** Develop on `claude/intelligent-allen-xv65ne`. Push
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

### 2026-06-14 — run 6 (Art. 30 record-of-processing artifact)

- **Picked up** run 5's next step: the Art. 30 ROPA artifact. This **completes
  the Retention & DSAR ops checklist item.**
- **Shipped (green):**
  - `lib/ropa.ts` (pure): `buildRopa` assembles the Art. 30(1) record from inputs
    (controller, taxonomy categories, region count, connector sources, retention
    window, outreach flag); `renderRopaMarkdown` renders the full document. Both
    tested.
  - `connectors/index.ts`: `connectorSources()` (id + licence per connector) as
    provenance input. `config.ts`: controller/DPO placeholders (env-overridable:
    `ROPA_CONTROLLER_NAME` / `_CONTACT` / `ROPA_DPO_CONTACT`).
  - `cli.ts`: `ropa [--write]` — prints, or writes `docs/ROPA.md`.
  - Generated `docs/ROPA.md` and committed it (regenerate with
    `npm run cli -- ropa --write`). README + LEGAL.md updated.
- **Verified:** `npm test` 63/63 green (was 59; +4 ROPA tests); `npm run build`
  clean. `cli ropa --write` produced a complete ROPA reflecting live inputs
  (6 categories, 20 regions, overpass+vies sources, 365-day retention,
  OUTREACH_ENABLED=false).
- **Next step:** with the compliance backbone now complete (collection,
  verification, suppression, retention/purge, DSAR, ROPA), move to **Phase 2
  enrichment**: a manual review queue / admin surface for the highest-value
  leads, and/or Tier-2 public contact-page enrichment (robots/ToS-gated, general
  inboxes only). Outreach (Phase 3) stays gated on counsel.

### 2026-06-14 — run 5 (DSAR access / erasure tooling)

- **Picked up** run 3's next step: the DSAR data-subject-rights CLI surface.
- **Shipped (Retention & DSAR ops, green):**
  - `lib/dsar.ts` (pure): `buildDsarReport` — assembles a portable Art. 15/20
    record from a subject's leads (provenance, parsed categories, ISO dates) +
    each lead's full audit trail. Tested.
  - `pipeline/dsar.ts`: `dsarExport(email)` (logs a `DSAR` access event per
    lead, returns the report) and `dsarErase(email)` (erases the subject's leads
    and adds a permanent **email-only** suppression — never the whole domain, so
    one person's objection can't block their employer's general contact).
  - `pipeline/erase.ts`: extracted the shared `eraseLead(lead, type, meta)`
    primitive (detached, personal-data-free audit row + delete); **purge** now
    reuses it instead of its own inline copy.
  - `cli.ts`: `dsar <export|erase> <email>`. README + LEGAL.md (DSAR marked
    implemented).
- **Verified:** `npm test` 59/59 green (was 55; +4 DSAR unit tests);
  `npm run build` clean. Offline smoke: `dsar export nagy.peter@gmail.com`
  returned the sole-trader lead with provenance + COLLECTED audit; `dsar erase`
  removed it + suppressed; re-export shows leadCount 0; re-collect skips the
  subject (suppressed); `purge --dry-run` still works after the eraseLead
  refactor.
- **Next step:** the **Art. 30 record-of-processing** artifact — a generated
  `docs/ROPA.md` (or a `cli -- ropa` report) describing purposes, categories of
  data/subjects, sources/recipients, retention, and the lawful basis, drawn from
  taxonomy + config so it stays current. After that: Tier-2 public contact-page
  enrichment (robots/ToS-gated) or a manual review queue.

### 2026-06-14 — run 4 (branch consolidation → main)

- **Why:** three parallel session branches existed off the Phase-1 base
  (`7c8f3b3`): `xv65ne` (this one — countrywide coverage + retention/purge +
  VIES), and `2lg214` / `fqxx72` which each *reimplemented the same* countrywide
  Overpass coverage. Asked to unify everything onto one **main** branch.
- **What I did:** based `main` on this branch (the functional superset — nothing
  from the others was missing in code). The only net-new artifact the parallel
  branches produced was an Overpass area-selector **test**; salvaged the more
  thorough version (`tests/overpass.test.ts`) so that work isn't lost. To adopt
  it, refactored `overpass.ts` to export `areaSelector(regionId)` + `buildQuery`
  (behavior-preserving; `AREA_QUERY` object → a `REGION_BY_ID` lookup helper).
- **Verified:** `npm test` 55/55 green (was 49; +6 overpass tests);
  `npm run build` clean.
- **Note:** `main` is now the integration branch; `xv65ne` is kept identical to
  it. The redundant `2lg214` / `fqxx72` / `39ybva` branches can be deleted — all
  their unique content is in `main`.

### 2026-06-14 — run 3 (VIES VAT verification / enrichment)

- **Picked up** run 2's next step: VAT verification as an enrichment step.
- **Shipped (Phase 2 start, green):**
  - `lib/vies.ts` (pure): `huVatForVies` (8-digit base for checksum-valid HU
    VAT only), `parseViesResponse` (normalizes VIES JSON; `---`/blank → null,
    whitespace-collapsed), `verificationPatch` (fills a *missing* address from a
    *valid* result — never overwrites, never enriches from invalid).
  - `connectors/vies.ts`: `checkVat(vat, {live})` — live calls the VIES REST API
    via the new `politePostJson` (identified UA + throttle); offline reads
    `fixtures/vies.json` keyed by the 8-digit base. Returns null when there's
    nothing to check (bad VAT / no fixture).
  - `pipeline/verify.ts`: scans leads with a VAT (default only unverified;
    `--revalidate` re-checks), stamps `lastVerifiedAt`, enriches a missing
    address (and recomputes `qualityScore`), writes a `VERIFIED` audit
    (`{source:"vies", valid}`, no personal data).
  - `cli.ts`: `verify [--live] [--limit N] [--revalidate]`. `config`/`.env`:
    `VIES_URL`. `fetcher.ts`: `politePostJson`.
  - Refactor: extracted the row→LeadInput mapping that was inline in `ingest.ts`
    into shared `lib/leadRow.ts` (`leadInputFromRow`); `ingest` + `verify` reuse
    it (no duplicated mapping).
  - Docs: README (status/quickstart), LEGAL.md (VIES now Implemented in the
    source-tier table).
- **Verified:** `npm test` 49/49 green (was 38; +11 VIES unit tests);
  `npm run build` clean. Offline smoke: collect budapest (7), `verify` →
  scanned 1/valid 1 (the HU10773381 lead), `lastVerifiedAt` set + `VERIFIED`
  audit; re-`verify` scans 0 (already verified); `--revalidate` re-checks (2nd
  audit). Enrichment branch exercised directly: cleared address → `verify`
  filled it from VIES and recomputed quality 0→100.
- **Next step:** DSAR (access / erasure / objection) CLI surface — `dsar export
  <email>` (gather a subject's leads + audit trail) and `dsar erase <email>`
  (reuse the purge erasure path + add a permanent suppression so re-collection
  can't resurrect them). Then an Art. 30 record-of-processing artifact
  (`docs/ROPA.md` or a `stats`-style generator).

### 2026-06-14 — run 2 (retention/erasure + countrywide coverage)

- **Picked up** the next step from run 1: countrywide Overpass coverage + the
  retention/purge gap (a lead stored *before* its suppression was skipped on
  re-ingest but never erased).
- **Shipped (Phase 1 cont., green):**
  - `lib/retention.ts` (pure): `purgeDecision` — purge if the lead's email /
    email-domain / website-domain is now suppressed (SUPPRESSED), or it's a
    never-engaged (`lifecycle=NEW`) personal-data lead past
    `PERSONAL_DATA_RETENTION_DAYS` (PERSONAL_DATA_EXPIRED). Suppression wins
    over type/age. 11 unit tests.
  - `pipeline/purge.ts`: loads the suppression set, scans all leads, and for
    each erasure writes a **detached** `PURGED` audit row (leadId=null so it
    survives the cascade delete; meta carries only the pseudonymous lead id,
    reason, source, region — no personal data) then deletes the lead.
  - `cli.ts`: `purge [--dry-run]`. `audit.ts`: `PURGED` type. `config.ts` +
    `.env.example`: `PERSONAL_DATA_RETENTION_DAYS` (default 365).
  - `connectors/overpass.ts`: `AREA_QUERY` now derived from `taxonomy.REGIONS`
    → all 19 counties + Budapest map to their OSM admin_level-6 area names
    (handles the "vármegye" suffix + the Budapest/Pest special cases), so
    `--live` works countrywide and stays in lockstep with Procura's regions.
  - Docs: README status/quickstart + LEGAL.md (retention job marked implemented,
    gap note).
- **Verified:** `npm test` 38/38 green (was 27); `npm run build` clean. Offline
  smoke: collect budapest (7 created), suppress 2 of them (one EMAIL, one DOMAIN
  matched via email-domain), `purge --dry-run` reports 2 (deletes nothing),
  `purge` erases 2 (stats 7→5), re-collect skips those 2 (suppressed); confirmed
  2 detached `PURGED` audit rows with no email in meta. County area-name
  derivation printed and checked for all 20 regions.
- **Next step:** add NAV/VIES VAT verification as an enrichment connector
  (set `lastVerifiedAt`, `VERIFIED` audit), then a DSAR (access/erasure/
  objection) CLI surface reusing the purge erasure path, and an Art. 30
  record-of-processing artifact.

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
