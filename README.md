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

Early scaffold. Implemented so far:

- Domain model (`prisma/schema.prisma`): `Lead`, `Suppression`, `AuditEvent`
- Procura-aligned taxonomy (`src/taxonomy.ts`) — identical category/region ids
- Pure libraries: `normalize`, `categorize`, `dedupe`
- Connectors: OSM Overpass (Tier-1, ODbL) with offline fixture
- Pipeline `ingest` + compliance (`suppression`, `audit`) + CLI
- Unit tests for the pure libraries

## Quickstart

```bash
npm install
cp .env.example .env
npx prisma db push
npm test                       # pure-library unit tests
npm run cli -- collect --source overpass --region budapest   # dry-run (fixture)
npm run cli -- collect --source overpass --region budapest --live   # real Overpass fetch
npm run cli -- stats
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

## Note on this folder

This project is intended to live in its **own repository**
(`github.com/jkarcsi/lead-discovery`). It currently sits in the Procura repo
under `lead-discovery/` only because the dedicated repo was not reachable from
the build session. It is fully self-contained (own `package.json`, `tsconfig`,
`prisma`) and excluded from the Procura web build. To extract it:

```bash
git subtree split --prefix=lead-discovery -b lead-discovery-export
git push git@github.com:jkarcsi/lead-discovery.git lead-discovery-export:main
```

(or simply copy the folder into the new repo).
