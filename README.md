# Procura Lead Discovery

A service that **legally** builds a database of Hungarian businesses,
categorized by Procura's taxonomy (category × region), so a buyer's RFQ can
also reach relevant **not-yet-registered** suppliers. Those suppliers can reply
(one-click, optional registration) and join — the growth loop that expands the
Procura network.

Plan & rationale: see `docs/LEGAL.md` here and the strategy doc in the main
Procura repo (`docs/lead-discovery-plan.md`).

> ⚠️ **Legal gate.** No data is collected and **no outreach is sent** before
> Hungarian data-protection counsel signs off the LIA/DPIA, privacy notice, and
> suppression/opt-out design (see `docs/LEGAL.md`). The code is built so that
> collection (Tier-1 open data) and outreach are separate, flag-gated phases.

## Status

**Phase 1 (open-data collection MVP) is complete and green.** Implemented:

- Domain model (`prisma/schema.prisma`): `Lead`, `Suppression`, `AuditEvent`
- Procura-aligned taxonomy (`src/taxonomy.ts`) — identical category/region ids
- Pure libraries: `normalize`, `categorize` (+ region detection), `dedupe`
  (VAT→domain→name key + merge), `quality` (0–100 score)
- Polite `fetcher` (identified UA, per-domain rate limit, robots.txt honored)
- Connectors: OSM Overpass (Tier-1, ODbL) with offline fixtures + live mode
- VAT verification: EU VIES `verify` step (Tier-1) — confirms a lead's VAT is
  registered, stamps `lastVerifiedAt`, fills a missing address, audits the check
- Pipeline `ingest` (transform → suppression → dedupe-merge → store + audit)
- Compliance: `suppression` (global do-not-contact, checked at ingest) + `audit`
  + `retention` (erase now-suppressed and expired never-engaged personal-data
  leads, with a detached audit trail)
- Operator CLI: `collect` / `verify` / `list` / `stats` / `suppress` / `purge`
  (no outreach — gated)
- Connector coverage: all 19 counties + Budapest (Overpass area mappings derived
  from the shared taxonomy)
- Unit tests (vitest) for the pure libraries

Roadmap and run history: `ROUTINE_PROMPT.md`. **No outreach** is built or
enabled — that phase is gated on counsel sign-off (`docs/LEGAL.md`).

## Quickstart

```bash
npm install
cp .env.example .env
npx prisma db push
npm test                       # pure-library unit tests
npm run cli -- collect --source overpass --region budapest   # dry-run (fixture)
npm run cli -- collect --source overpass --region budapest --live   # real Overpass fetch
npm run cli -- verify                                         # VAT-check leads (fixture)
npm run cli -- verify --live                                  # real EU VIES lookups
npm run cli -- stats
npm run cli -- purge --dry-run                                # preview retention erasures
```

Without `--live`, the Overpass connector reads `src/connectors/fixtures/`, so
the pipeline runs fully offline. `--live` hits the public Overpass API (ODbL;
attribution required) and honors polite rate limits.

## Architecture

```
sources → connectors → normalize → categorize → dedupe → Lead store (Postgres/SQLite)
                                   compliance: suppression / audit / opt-out / retention
                                   → export to Procura (cold invites, "claim profile")
```

Stack: Node + TypeScript + Prisma (SQLite in dev, Postgres in prod). The
taxonomy and categorization mirror Procura so leads slot straight into its
matching.

## License

Proprietary — see `LICENSE`. OSM-derived data is ODbL and requires attribution
(© OpenStreetMap contributors).
