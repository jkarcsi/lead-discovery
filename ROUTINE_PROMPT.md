# Procura Lead Discovery — Implementation Plan & Recurring Development Routine

> **Reconciliation note (2026-06-14, added when this plan was installed).**
> This plan was provided as the governing brief. Two facts in the original were
> corrected so automated routine rounds stop re-starting from scratch and
> spawning duplicate branches:
> - **Dev branch** below was `claude/intelligent-allen-39ybva` (the *original*
>   name, stuck at the Phase-1 base `7c8f3b3`). The real, most-advanced line of
>   work is **`claude/intelligent-allen-xv65ne`**, fast-forwarded to **`main`**.
>   Build there. (Several stale branches — `2lg214`, `fqxx72`, `39ybva`, `8jgyss`,
>   `qkh0sa`, `qvbuq9`, `sleepy-fermat-evk9fm` — each re-did Phase-1a work that is
>   already in `main`; ignore them, they can be deleted.)
> - **Latest Status** was stale (claimed only Phase 1 / 27 tests). It now
>   reflects reality (97 tests; connectors + enrichment + efficiency rewrite).
> - **Open framing question for the operator:** a prior instruction asked to drop
>   the legality emphasis and go efficiency-first; this plan is legal-first. Both
>   are honored where possible — the efficiency infrastructure (concurrency,
>   batched writes, paginated-source factory, resume cursors) is kept *because it
>   makes building these 12 sources fast*, and provenance/personal-data flagging
>   is retained. `docs/LEGAL.md` (gate) and `docs/SCOPE.md` (efficiency tooling)
>   both exist. Confirm which framing should lead and the docs will follow.

## Mission
Ship collection and enrichment across Hungarian open-data sources, building a
categorized, deduplicated database of businesses to reach not-yet-registered
suppliers — efficiently and with provenance on every record. Every run must move
forward measurably and keep the repo green.

## Dev Branch
`claude/intelligent-allen-xv65ne` (integration branch: `main`, kept fast-forwarded)

## Legal Gate
Collecting business data and (later) sending B2B inquiries touches GDPR, Hungarian
advertising law, e-commerce law, and ePrivacy. The legality of *use* is owned by
the operator separately; this codebase keeps the technical guardrails. See
`docs/LEGAL.md`. Key constraints:
- No outreach ships before legal counsel approval; `OUTREACH_ENABLED` stays off.
- Collection from open data; Sensitive sources (EVNY sole traders) are flag-gated.
- Every record requires provenance: `source`, `sourceUrl`, `sourceLicense`,
  `collectedAt`; `isPersonalData` flagged for sole traders / named contacts.
- Suppression checked at ingest (and at send, later).

## Data-Source Priority (Build Top-Down)

| # | Source | Role | Personal Data? | Status |
|---|--------|------|----------------|--------|
| 1 | OSM/Overpass | Discovery POIs | Rarely | ✅ all 20 regions |
| 2 | e-beszámoló/Céginformációs Szolgálat | Company backbone + financials | Company | ✅ connector (master + reg.no + TEÁOR) |
| 3 | NAV databases | Verification + risk signals | Company (sole-trader = personal) | ⬜ |
| 4 | VIES (EU VAT) | Cross-border validation | Company | ✅ `verify` step |
| 5 | Közbeszerzés (EKR/TED) | Active supplier proof | Company | ⬜ |
| 6 | KSH-TEÁOR | Classification reference | N/A | ⬜ |
| 7 | MKIK chamber registry | Coverage cross-check | Company | ⬜ |
| 8 | OpenCorporates | Aggregator/normalization | Mixed | ⬜ |
| 9 | Google Places API | Contact enrichment (Tier-2) | Company | ⬜ |
| 10 | Website contact pages | Email/phone enrichment (Tier-2) | May be personal | ◻ `htmldir`/`directory` scrapers exist |
| 11 | Aranyoldalak/Telefonkönyv | Listings (Tier-2) | Mixed | ◻ generic paginated connector exists |
| 12 | EVNY (Sole traders) | Sole-trader coverage (Sensitive) | **Yes – flag-gated, last** | ⬜ |

## Phase Checklist

- ✅ **Phase 1 — Open-data MVP:** schema, taxonomy, pure libs, fetcher, overpass connector, ingest pipeline, CLI
- 🟡 **Phase 1a — Registry backbone:** ✅ e-beszámoló connector (company master + reg.no + TEÁOR, enriches by VAT); ✅ OSM all 20 regions. Next: financials fields.
- ⬜ **Phase 1b — Tax verification:** NAV connector (headcount, debt-free flag, execution risk); VIES batch (✅ `verify` exists, add batch driver)
- ⬜ **Phase 1c — Procurement signal:** EKR/Közbeszerzési Értesítő/TED connector, CPV→taxonomy mapping
- ⬜ **Phase 1d — Classification & cross-check:** KSH-TEÁOR tables, MKIK, OpenCorporates dedupe
- ⬜ **Phase 2 — Enrichment (Tier-2, gated):** Google Places + polite crawl, quality refinements
- ⬜ **Phase 2s — Sole traders (Sensitive, flag-gated):** EVNY connector behind explicit flag
- 🟡 **Retention & DSAR ops:** ✅ purge job, ✅ DSAR access/erasure, ✅ Art. 30 ROPA
- ⬜ **Phase 3 — Cold-invite loop (GATED on counsel):** export to Procura, opt-out endpoint
- ⬜ **Phase 4 — Scale & monitor:** dashboards, auto-suppression

(Already shipped beyond the original plan: concurrent multi-region collection,
batched writes, a paginated-source factory + resume cursors, JSON `directory` &
HTML `htmldir` connectors, a manual `review` queue.)

## Hard Rules

1. **Language split:** Hungarian for user-facing product, English for codebase.
2. **Branch discipline:** develop on the dev branch above; never push to `main`
   directly except a fast-forward of the dev branch. Never open a PR unless asked.
3. **Taxonomy parity:** category/region IDs must match Procura's; mirror CPV mapping.
4. **Build discipline:** `npm test` and `npm run build` pass before every push;
   pipeline fully offline via fixtures (`--live` opt-in); pure libs I/O-free + tested.
5. **Respect the gate:** no outreach path, no `OUTREACH_ENABLED`, no Sensitive
   sources without counsel sign-off.
6. **Provenance required:** `source`, `sourceUrl`, `sourceLicense`, `collectedAt`,
   `isPersonalData` on every record.
7. **Efficiency:** new sources go through the paginated-source factory; batch DB
   work; fetch concurrently; resume incrementally.

## Environment Setup
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

## How to Work a Run

1. Read this file (esp. Latest Status) and `docs/LEGAL.md` / `docs/SCOPE.md`.
2. Pick the next unchecked phase item (default now: **Phase 1b — NAV verification
   connector**, or financial fields for e-beszámoló).
3. Implement with tests; pure logic in `src/lib/*`, side-effects in
   `src/pipeline/*` and `src/connectors/*` (new sources via the paginated factory).
4. Verify green: `npm test`, `npm run build`, an offline CLI smoke.
5. Commit (clear English message), push to the dev branch, fast-forward `main`.
6. Append a dated entry to the status log below.

## Repo Structure
- `prisma/schema.prisma` — Lead/Suppression/AuditEvent/CrawlState schema
- `src/taxonomy.ts` — Procura-aligned categories + regions (CPV mapping: planned)
- `src/lib/` — pure, tested logic (parsers, concurrency, paginate, dedupe, …) + side-effecting fetcher
- `src/connectors/` — source connectors (overpass, directory, htmldir, ebeszamolo) + `paginated.ts` factory + fixtures
- `src/pipeline/` — ingest (concurrent fetch) → store (batched writes), verify, review, purge, dsar, crawlState
- `src/cli.ts` — operator CLI
- `tests/` — vitest unit tests
- `docs/LEGAL.md` — compliance gate; `docs/SCOPE.md` — efficiency/tooling; `docs/ROPA.md` — generated Art. 30 record

## Status log (newest first)

### 2026-06-14 — run 12 (plan install + Phase 1a e-beszámoló registry connector)

- **Installed this plan** as the routine brief (reconciled dev branch + status;
  see the note at the top). Checked the repo: the latest automatic round had
  spawned 4 more branches (`8jgyss`, `qkh0sa`, `qvbuq9`, `sleepy-fermat-evk9fm`)
  all re-doing Phase-1a Overpass work already present in `main` — ignored.
- **Shipped (Phase 1a, green):** `lib/companyRegistryParse.ts` (pure) +
  `connectors/ebeszamolo.ts` (on the paginated factory) — company master data
  with **cégjegyzékszám (registrationNumber)** and **TEÁOR** activity, budapest
  fixture. Registry records merge into existing leads by VAT, enriching them with
  authoritative identity. `config.ebeszamoloUrl`; registered as `ebeszamolo`.
- **Verified:** `npm test` 97/97 (was 93; +4 registry tests); `npm run build`
  clean. Smoke: `Connectors: overpass, directory, htmldir, ebeszamolo`; overpass
  budapest (7) then ebeszamolo budapest (2 new + 1 merged) → Tiszta Iroda gained
  `registrationNumber 01-09-111111`; 9 leads total.
- **Next:** Phase 1b — NAV verification connector (headcount / debt-free flag /
  execution-risk signals), or add financial fields to the e-beszámoló record.
  Also pending: operator's confirmation on the legal-first vs efficiency-first
  framing (see top note).

(Earlier runs 1–11: countrywide Overpass, VIES verify, retention/purge, DSAR,
Art. 30 ROPA, manual review queue, efficiency rewrite — concurrency + batched
writes + paginated-source factory + resume cursors — and the directory/htmldir
connectors. Full detail in git history.)
