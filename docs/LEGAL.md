# Legal & compliance gate

> **This document describes the *defensible approach we will validate with
> counsel*, not settled legal advice.** Nothing in this project collects data
> beyond Tier-1 open data, and **no outreach is sent**, until Hungarian
> data-protection counsel signs off the LIA, DPIA, privacy notice, and the
> suppression/opt-out design. `OUTREACH_ENABLED` stays `false` until then.

## Why a gate at all

Building a database of Hungarian businesses and sending unsolicited B2B
inquiries touches **GDPR**, the Hungarian advertising act (**Grt.**, 2008. évi
XLVIII. tv.), the e-commerce act (**Eker. tv.**, 2001. évi CVIII. tv.) and
**ePrivacy** rules. The supervisory authority is **NAIH**. The design below is
compliance-first; the gate ensures we never act on it before it is reviewed.

## What data we touch (and what we never touch)

- **Legal entities (Kft., Zrt., Bt., …):** company data and a company's
  *general* business contact (`info@`, `iroda@`, public phone) is largely **not
  personal data**.
- **Sole traders (egyéni vállalkozó) and named-person contacts:** **personal
  data** → full GDPR. The pipeline flags these (`Lead.isPersonalData`) so they
  can be treated more conservatively (e.g. excluded from early outreach).
- **Never collected:** special-category data, employees' personal data beyond a
  public general contact, or anything behind authentication / paywalls.

## Lawful basis (to be validated)

- **GDPR Art. 6(1)(f) legitimate interest** for collecting public business
  contact data and sending a *genuine, relevant* business inquiry (a specific
  RFQ is transactional, not generic advertising). This requires:
  - a documented **Legitimate Interest Assessment (LIA)** and a **DPIA**
    (Art. 35 — large-scale collection from third-party sources);
  - **Art. 14 transparency** for indirectly-collected data: a public privacy
    notice **and** a source disclosure inside the first message;
  - **easy objection / opt-out (Art. 21)**, honored permanently;
  - **data minimization & retention limits (Art. 5)**;
  - an **Art. 30 record of processing**.

## Communication rules (when outreach is eventually enabled)

- **One message per lead** until they engage. No nagging, no repeat promo to
  non-responders.
- Every message **identifies the sender**, states it is a business outreach,
  **names the data source** (Art. 14 / Eker. tv.), and offers a **free,
  one-click opt-out** honored immediately and globally.
- **Global suppression list** checked before every send; opt-out and hard
  bounce → permanent suppression.
- **Volume/frequency caps**, complaint-rate monitoring, auto-pause.
- A **separate sending identity** (subdomain, SPF/DKIM/DMARC, warmup) so cold
  traffic never threatens Procura's transactional deliverability.

## Source legality

- **robots.txt + Terms of Service are honored.** No bypassing auth, paywalls,
  rate limits, or anti-bot measures. Identified `User-Agent` with a contact URL
  (`CRAWLER_USER_AGENT` / `CRAWLER_CONTACT_URL`); per-domain rate limiting
  (`MIN_REQUEST_INTERVAL_MS`). Enforced in `src/lib/fetcher.ts`.
- **Prefer official open data / APIs** over HTML scraping.
- **No re-publishing** of source data; store only what's needed for matching +
  outreach, with **provenance** on every record (`source`, `sourceUrl`,
  `sourceLicense`, `collectedAt`).

### Source tiers

| Tier | Source | Status here |
|---|---|---|
| 1 | **OSM / Overpass** (ODbL, attribution) | **Implemented** (`overpass` connector) |
| 1 | Company registry (e-cégjegyzék), NAV/VIES VAT, KSH/TEÁOR, MKIK chamber | Planned — most need a contract/licence for automation; check ToS first |
| 2 | A business's own public contact page (Impresszum/Kapcsolat) | Planned, robots/ToS-gated, rate-limited, general inboxes only |
| 3 | Google Places & other platforms | **Only** via official API within ToS, as discovery hints — never scraped, never stored as a record of origin |

## Data-subject rights & ops (must-haves before any send)

- Public **privacy notice** (sources, basis, retention, rights).
- **LIA + DPIA** completed and signed off.
- **Opt-out endpoint** (tokenized, no login) → instant global suppression.
- **DSAR** workflow (access / erasure / objection) with an SLA + audit.
- **Retention job**: purge personal-data leads never engaged after N months;
  re-verify business data periodically.
- **Provenance** + **Art. 30** record kept current.
- **Complaint & bounce monitoring** with automatic campaign pause thresholds.

## How the code enforces the gate

- `OUTREACH_ENABLED` defaults to `false`; there is **no outreach command** in
  the CLI yet — Phase 1 only collects and categorizes.
- `Lead.isPersonalData`, `gdprBasis`, and the provenance fields are populated on
  every record at ingest.
- `Suppression` is checked at **ingest** (and will be at send): a suppressed
  email/domain is never (re)stored with contactable data
  (`SUPPRESSED_SKIP` audit event).
- `AuditEvent` records every collect / merge / suppression / (future) contact /
  opt-out / DSAR for accountability.

See `../docs/lead-discovery-plan.md` in the Procura repo for the full strategy.
