# Legal & compliance gate

> The **legality of acquiring and using** the data is owned by the operator
> (legal review, separate workstream). This codebase keeps the **technical
> guardrails** the plan requires: provenance, personal-data flagging,
> suppression, retention, DSAR, and an Art. 30 record. See also `docs/SCOPE.md`
> for the collection-efficiency tooling.

## Gate

- **No outreach ships** before legal counsel approval. `OUTREACH_ENABLED` stays
  `false`; there is no send path in the CLI.
- **Open data first.** Sensitive sources (notably **EVNY** sole-trader data) are
  **flag-gated and built last**, never enabled without explicit sign-off.
- **Provenance on every record:** `source`, `sourceUrl`, `sourceLicense`,
  `collectedAt`. `isPersonalData` flags sole traders / named contacts so they can
  be handled conservatively.
- **Suppression** is checked at ingest now (and at send later); opt-out / bounce
  suppress permanently. `purge` erases now-suppressed and expired personal-data
  leads; `dsar` provides access/erasure; `ropa` generates the Art. 30 record.

## Data-source tiers (build top-down)

| # | Source | Tier | Personal data | Status |
|---|--------|------|---------------|--------|
| 1 | OSM / Overpass (ODbL) | 1 | rarely | implemented (all 20 regions) |
| 2 | e-beszámoló / Céginformációs Szolgálat | 1 | company | implemented (master + reg.no + TEÁOR) |
| 3 | NAV databases | 1 | company (sole-trader = personal) | planned |
| 4 | VIES (EU VAT) | 1 | company | implemented (`verify`) |
| 5 | Közbeszerzés (EKR / TED) | 1 | company | planned |
| 6 | KSH-TEÁOR | 1 | n/a | planned |
| 7 | MKIK chamber | 1 | company | planned |
| 8 | OpenCorporates | 1 | mixed | planned |
| 9 | Google Places API | 2 | company | planned (official API only) |
| 10 | Website contact pages | 2 | may be personal | generic scraper exists |
| 11 | Aranyoldalak / Telefonkönyv | 2 | mixed | generic paginated connector exists |
| 12 | EVNY (sole traders) | sensitive | **yes** | **flag-gated, last** |

## How the code enforces the gate

- Provenance + `isPersonalData` set at ingest on every record.
- `Suppression` checked at ingest (`SUPPRESSED_SKIP` audit); `purge` erases
  now-suppressed leads with a detached, personal-data-free audit row.
- `AuditEvent` records collect / merge / verify / review / suppress / erase.
- No outreach command exists; `OUTREACH_ENABLED` defaults `false`.
