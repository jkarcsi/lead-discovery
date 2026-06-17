# Procura Lead Discovery — project plan

A **separate project** (proposed repo: `procura-leads`) that legally builds a
database of Hungarian businesses, categorized by the same taxonomy as Procura,
so that a buyer's RFQ can also reach **relevant, not-yet-registered** suppliers.
Those suppliers respond (with optional one-click reply) and register — which is
itself the growth loop that expands Procura's user base.

> ⚠️ **Legal gate.** Collecting business contact data and sending unsolicited
> B2B inquiries touches GDPR, the Hungarian advertising act (Grt.), the
> e-commerce act (Eker. tv.) and the ePrivacy rules. This document describes a
> compliance-first design, **but nothing here ships without written sign-off
> from Hungarian data-protection counsel.** Treat every "legal" claim below as
> "the defensible approach we will validate with counsel," not settled advice.

---

## 1. Goal & growth loop

```
collect public business data  →  categorize like Procura (category × region)
        →  buyer creates an RFQ  →  matching also surfaces relevant LEADS
        →  cold invite to the lead's public business email (token reply link,
           clear data-source notice, one-click opt-out, "register to manage")
        →  lead submits an offer without registering (free quota)  OR  registers
        →  on registration the lead is CLAIMED → becomes a real SupplierProfile
        →  network grows; future RFQs reach them as a normal supplier
```

This is the `extraEmails` feature in Procura, scaled by a curated, consented,
categorized lead database — with strict anti-spam and opt-out guarantees.

Success = qualified suppliers added at low cost **without** spam complaints,
blocklisting, or regulatory exposure.

---

## 2. Legal foundation (design, to be validated by counsel)

### 2.1 What kind of data

- **Legal entities (Kft., Zrt., Bt., …):** company data and a company's
  *general* business contact (e.g. `info@`, `iroda@`, public phone) is largely
  not personal data — but a named person's email *is* personal data.
- **Sole traders (egyéni vállalkozó) and named contacts:** **personal data** →
  full GDPR applies.
- **Never collect** special-category data, personal data of employees beyond a
  public business contact, or anything behind authentication/paywalls.

### 2.2 Lawful basis (GDPR)

- **Art. 6(1)(f) legitimate interest** for collecting public business contact
  data and sending a genuine, relevant business inquiry (an RFQ is a
  transactional request, not generic advertising). Requires:
  - a documented **Legitimate Interest Assessment (LIA)** and a **DPIA**
    (large-scale collection from third-party sources triggers Art. 35);
  - **transparency to data subjects whose data we collected indirectly
    (Art. 14):** a public privacy notice + the source disclosure inside the
    first message;
  - **easy objection / opt-out (Art. 21)** honored permanently;
  - **data minimization & retention limits** (Art. 5).
- Authority: **NAIH** (Hungary). Maintain an **Art. 30 record of processing**.

### 2.3 Communication rules

- **Grt. (2008. évi XLVIII. tv.)** governs *reklám* (advertising). The cautious
  reading: a first message that is a **specific RFQ relevant to that business**
  is a business inquiry, not advertising — but anything that drifts toward
  generic promotion needs prior consent for natural persons. Keep messages
  strictly transactional and relevant; **never** send repeat promo to
  non-responders.
- **Eker. tv. (2001. évi CVIII. tv.)** + ePrivacy: electronic commercial
  communication must **clearly identify the sender**, state it's a business
  outreach, name the **source of the data**, and offer a **free, one-click
  opt-out** that is honored immediately.
- Operational guarantees regardless of legal nuance:
  - **One message per lead** until they engage; no nagging.
  - **Global suppression list**; opt-out and bounce → permanent suppression.
  - **Frequency/volume caps**; complaint-rate monitoring with auto-pause.

### 2.4 Source legality (respect each source's terms)

- **robots.txt + Terms of Service are honored.** No bypassing auth, paywalls,
  rate limits, or anti-bot measures. Identified User-Agent with a contact URL.
  Per-domain politeness/rate limiting.
- **No re-publishing** of source data; we store only what's needed for matching
  + outreach, with provenance recorded per record.
- Prefer **official open data / APIs** over HTML scraping (see §4 tiers).

### 2.5 Data-subject rights & ops

Public privacy policy; DSAR intake (access/erasure/objection) with SLA;
suppression honored across the whole system; provenance + timestamps on every
record for accountability; periodic purge of never-engaged personal-data leads.

---

## 3. Architecture (separate service)

```
 sources ──▶ connectors ──▶ fetch (robots+rate-limit) ──▶ parse/extract
        ──▶ normalize ──▶ categorize (Procura taxonomy) ──▶ geocode→region
        ──▶ dedupe (VAT / domain / name+address) ──▶ enrich/verify
        ──▶ quality score ──▶ Lead store (Postgres)
                                   │
                 compliance services (suppression, opt-out, DSAR, audit, retention)
                                   │
                        sync/export  ──▶  Procura (matching + cold invites)
```

- **Stack:** Node/TypeScript worker service, Postgres, Redis + a job queue
  (BullMQ) for scheduling and per-domain rate limiting, an admin UI for review.
- **Politeness:** `robots-parser`, per-domain token-bucket, identified UA,
  backoff, caching; configurable crawl windows.
- **Reuse Procura logic:** import the **same taxonomy** (`CATEGORIES`,
  `REGIONS`, keyword + region detection) so categorization is identical;
  optionally embeddings (backlog M1) for better classification.

---

## 4. Data sources (tiered by legal safety)

**Tier 1 — official / open data (preferred):**

- **Company registry (cégnyilvántartás)** via the *Céginformációs Szolgálat* /
  `e-cegjegyzek.hu` — authoritative legal name, registration number, seat,
  scope of activity. Bulk/automated access typically needs a **contract/licence**
  (the free lookup is for individual queries; check ToS before any automation).
- **NAV** public taxpayer database + **VAT-number validity** (and EU **VIES**)
  for verification.
- **KSH** statistical business register / TEÁOR activity codes for category
  mapping (aggregate; respect identifiability limits).
- **MKIK / chamber registries** — mandatory chamber membership data, often
  public; ideal for partnerships (backlog G8).
- **OpenStreetMap** (ODbL, attribution) via the Overpass API — POIs tagged
  `shop`/`office`/`craft`/`amenity` give name, address, often phone/website.

**Tier 2 — public business web pages (now a PRIMARY source, with care):**

- A business's **own public website** (Impresszum/Kapcsolat plus
  "rólunk"/"szolgáltatások" pages) for a general business email/phone **and for
  the services it offers** — only where robots.txt + ToS permit, rate-limited,
  identified, no personal emails of individuals where a general inbox exists.
- **Promoted from enrichment to a first-class supply source.** Many firms have no
  usable TEÁOR mapping and aren't in open data, but their own site states plainly
  what they do — enough to categorize and contact them. Where the **operating
  area (category) still can't be determined by rules** (taxonomy keyword +
  activity-code mapping), classify the scraped text with the **cheapest AI path**:
  Claude **Haiku 4.5** via the **Message Batches API** (50% off, offline job),
  **prompt-caching** the taxonomy/instructions prefix, **structured outputs**
  constrained to the taxonomy enum, and **storing the decision on the Lead** so
  it is computed once. Low-confidence results go to manual review, never to
  auto-outreach. See `IMPLEMENTATION_PLAN.md` §9.1 for the full design.

**Tier 3 — third-party platforms (only via official APIs, within ToS):**

- **Google Places API** etc. — usable through the *official API within its
  terms*, but most forbid building a permanent database from their content, so
  treat as discovery hints, not a store of record. **Do not scrape** Google/
  directory HTML.

> Categorization maps each source's activity codes / tags / free text to a
> Procura category via the shared taxonomy; region from the seat/address.

---

## 5. Lead data model (mirrors `SupplierProfile`)

```
Lead {
  id
  legalName, brandName
  vatNumber, registrationNumber          // for dedupe + verification
  categoryIds[]   // Procura taxonomy
  regionId        // Procura taxonomy (from seat/address)
  emails[], phones[], website, address
  source, sourceUrl, collectedAt, lastVerifiedAt   // provenance
  gdprBasis        // "legitimate_interest"
  isPersonalData   // true for sole traders / named contacts
  qualityScore
  lifecycle: NEW | CONTACTED | RESPONDED | REGISTERED | SUPPRESSED
  suppression { suppressed, reason, at }
  notes
}
Suppression { emailOrDomain, reason, at }   // global, checked before every send
AuditEvent  { leadId, type, meta, at }       // collected/contacted/opt-out/DSAR
```

Dedupe priority: VAT number → website domain → normalized name+address.

---

## 6. Integration with Procura (the cold-invite loop)

- **Matching includes leads.** When an RFQ's category+region matches leads (and
  no registered supplier covers them well), the buyer can choose to also reach
  N leads — explicit, capped, opt-in per RFQ.
- **Reuse `RfqInvite`** with `source = "COLD"` and a `leadId` reference. The
  cold email differs from a normal invite:
  - clearly identifies Procura + the buyer's RFQ,
  - **states where we got their data** (Art. 14) and that they were not
    registered,
  - one-click **opt-out** (permanent suppression) + a **"regisztrálj a
    megkereséseid kezeléséhez"** CTA,
  - the existing token reply page lets them quote **without** registering (free
    quota; ties to backlog S6).
- **Claim & convert.** On registration from a cold invite, match by VAT/domain
  and **merge the lead into a `SupplierProfile`** (pre-fill categories/regions
  from the lead); mark lifecycle `REGISTERED`. Dedupe so a claimed business is
  never cold-contacted again.
- **Suppression is shared.** Procura must check the suppression list before any
  cold send; opt-out from any message suppresses globally and forever.
- **Caps.** Hard per-day/-domain cold-send caps, complaint-rate auto-pause, and
  deliverability hygiene (dedicated subdomain, SPF/DKIM/DMARC, warmup) so cold
  traffic never threatens transactional deliverability.

---

## 7. Compliance operations (must-haves before any send)

- Public **privacy notice** describing sources, basis, retention, rights.
- **LIA + DPIA** completed and signed off.
- **Opt-out endpoint** (tokenized, no login) + instant global suppression.
- **DSAR** workflow (access/erasure/objection) with SLA + audit.
- **Retention job**: purge personal-data leads never engaged after N months;
  re-verify business data periodically.
- **Provenance** on every record; **Art. 30** processing record kept current.
- **Complaint & bounce monitoring** with automatic campaign pause thresholds.

---

## 8. Phasing

- **Phase 0 — Legal (blocking):** counsel review, LIA, DPIA, privacy notice,
  Art. 30 record, suppression + opt-out design. No data collected before this.
- **Phase 1 — Open-data MVP:** Tier-1 sources (OSM/Overpass + company registry +
  chamber data) for the 6 beachhead categories in Budapest + Pest; build the
  Lead store + categorization + dedupe + admin review. No outreach yet.
- **Phase 2 — Tier-2 sites as a primary source + verification:** collect from
  business websites as a first-class supply source (robots/ToS-compliant),
  categorize undetermined leads with the low-cost AI path (Haiku 4.5 + Batch API
  + prompt caching + structured outputs, stored once — §9.1 of the plan), plus
  VAT/VIES verification, quality scoring, and a manual review queue.
- **Phase 3 — Cold-invite loop (gated):** integrate with Procura behind a flag,
  tiny volume, heavy monitoring; measure deliverability, response, registration,
  opt-out, complaints; iterate copy/targeting.
- **Phase 4 — Scale & monitor:** widen categories/regions only while
  complaint/opt-out rates stay low; dashboards, alerts, automated suppression.

---

## 9. Metrics

Collection: leads/day, coverage per category×region, dedupe rate, data quality.
Outreach: deliverability, open/response, **registration conversion**,
**opt-out rate**, **complaint rate** (the guardrails). Network effect: cold →
registered suppliers, and their subsequent organic activity.

---

## 10. Key risks & mitigations

| Risk | Mitigation |
|---|---|
| Spam complaints / blocklisting | One-message rule, strict caps, suppression, separate sending domain, deliverability hygiene, complaint auto-pause |
| Regulatory (NAIH) exposure | LIA/DPIA, legitimate-interest + Art. 14 transparency, opt-out, counsel sign-off, conservative targeting (businesses, general inboxes) |
| Source ToS / robots violations | Tier-1 official sources first; honor robots/ToS; official APIs only for Tier-3; no auth/paywall bypass; identified UA + rate limits |
| Poor data quality → irrelevant outreach | Verification (VAT/VIES), quality score, manual review, relevance threshold before any cold send |
| Brand damage from "scraping" perception | Frame as a curated, consented B2B directory with one-click opt-out; transparency notice; never nag |
| Deliverability harm to transactional mail | Separate subdomain/IP for cold; keep RFQ/account emails on the trusted domain |

---

## 11. Relationship to Procura backlog

This project is backlog item **G1**; it enables **G2 (claim profile)**,
benefits from **O2 (supply-gap alerts)** to prioritize which categories/regions
to collect, and feeds **$4 (lead marketplace)**. It must **not** weaken the
core product's email deliverability or trust — hence the separate sending
identity and the hard opt-out/suppression guarantees.
