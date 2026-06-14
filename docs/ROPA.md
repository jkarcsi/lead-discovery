# Record of Processing Activities (GDPR Art. 30)

> Generated from the codebase (taxonomy, config, connectors) by `npm run cli -- ropa`.
> Living operational record, not legal advice — validate with counsel (see docs/LEGAL.md).

**Generated:** 2026-06-14T05:31:13.643Z

## Controller

- Name: Procura (operator) — TBD with counsel
- Contact: privacy@procura.hu (placeholder)
- DPO: No DPO appointed yet — assess need (Art. 37)

## Purposes of processing

- Build a categorized database of Hungarian businesses so a buyer's RFQ can also reach relevant not-yet-registered suppliers (the Procura growth loop).
- Verify and de-duplicate business records to keep matching accurate.

## Lawful basis

GDPR Art. 6(1)(f) legitimate interest (collecting public business contact data; a genuine, relevant business inquiry is transactional, not generic advertising). Subject to a documented LIA + DPIA before any outreach — see docs/LEGAL.md.

## Categories of data subjects

- Legal entities (Kft., Zrt., Bt., …) — company data and general business contacts are largely NOT personal data.
- Sole traders (egyéni vállalkozó) and named-person contacts — personal data; flagged isPersonalData and treated conservatively.

## Categories of personal data

- Business identity: legal/brand name, VAT number, registration number
- Business contact: general email, phone, website/domain, postal address
- Classification & provenance: category ids, region, source, source URL, licence, collection/verification timestamps

## Special categories

None. No special-category (Art. 9) data, and nothing behind authentication or paywalls, is collected.

## Business coverage

- Regions: 20 (all 19 counties + Budapest)
- Categories: Takarítás (cleaning); HVAC / klíma karbantartás (hvac); Őrzés-védelem (security); Munkavédelem (occupational-safety); Tűzvédelem (fire-safety); IT üzemeltetés / support (it-support)

## Sources

- overpass — licence: ODbL
- vies — licence: EU VIES (European Commission)

## Recipients

- None currently. No outreach or third-party sharing is enabled (OUTREACH_ENABLED=false).
- Planned (gated on counsel sign-off): export to Procura for the cold-invite loop — not active.

## International transfers

None. Data is stored within the EU; no transfers to third countries.

## Retention

- Never-engaged personal-data leads: erased 365 days after collection (cli purge; configurable via PERSONAL_DATA_RETENTION_DAYS).
- Suppression list (opt-outs, bounces, DSAR erasures): retained permanently to honor do-not-contact.
- Audit trail: retained for accountability (Art. 5(2)); erasure leaves a detached, personal-data-free record.

## Technical & organizational measures

- Global suppression checked at ingest (and at send, once gated outreach exists).
- Provenance on every record (source, source URL, licence, collectedAt).
- Append-only audit trail of every collect / merge / verify / suppress / erase.
- Polite collection only: identified User-Agent + contact URL, per-domain rate limits, robots.txt honored; no auth/paywall bypass.

## Data-subject rights (how exercised)

- Access / portability (Art. 15/20): `cli dsar export <email>` returns a full copy of what is held plus the audit trail.
- Erasure / objection (Art. 17/21): `cli dsar erase <email>` erases the subject's leads and permanently suppresses the address.
- Transparency (Art. 14): public privacy notice + source disclosure in the first message (pending outreach phase).

