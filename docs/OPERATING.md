# Operating guide

How to run a real collection and end up with **emailable, categorized leads**.
The deliverable is an email address plus a category (which quote to send); this
guide is ordered around that goal. Commands are English per the repo convention;
CLI output is Hungarian.

## Mental model

The system is a **multi-source pipeline**, not a single web crawler. A lead is
built up in layers, and the email almost never comes from the discovery layer:

```
DISCOVERY            DEDUPE                ENRICHMENT (email!)      CATEGORIZE        EXPORT
overpass  ─┐                              enrich  (website → email) TEÁOR/CPV codes
directory  ├─►  merge on dedupe key  ─►   places  (Places → phone)  + keyword text ─► report → export
htmldir    │    VAT→regno→domain→name     verify  (VIES VAT)                          (NDJSON →
ebeszamolo │                              nav     (tax status)                          Procura)
…sources  ─┘
```

- **Discovery** finds who exists and, crucially, their **website**.
- **`enrich`** opens each lead's website (`/`, `/kapcsolat`, `/impresszum`,
  `/contact`) and scrapes the **email** + phone. This is the main email engine.
- **Categorization** runs automatically during collection — from authoritative
  TEÁOR/CPV codes where available, unioned with keyword matches.

So: discovery gives websites, `enrich` turns websites into emails. Running only
`collect --source overpass` (discovery) is why you saw "few emails".

## One-time setup

```bash
npm install
cp .env.example .env          # then edit .env (see Tuning + Live mode)
npx prisma generate
npx prisma db push            # creates/updates the SQLite dev.db
npm test                      # 135 green
```

**Windows + WSL note.** The repo can be used from Windows PowerShell and WSL on
the same drive, but native binaries are per-platform. If you switch to WSL on a
node_modules installed from Windows:

```bash
npm install --no-save @esbuild/linux-x64 @rolldown/binding-linux-x64-gnu  # tsx + vitest
npx prisma generate                                                       # Linux query engine
```

`prisma/schema.prisma` already targets both (`binaryTargets = ["native",
"windows", "debian-openssl-3.0.x"]`), so `prisma generate` works on either host.

## The recommended live run (email-optimized)

```bash
# 1. Discover businesses (+ their websites) across the whole country.
npm run cli -- collect --source overpass --region all --live

# 2. (optional) Add registry/aggregator sources for identity + categorization.
npm run cli -- collect --source ebeszamolo    --region all --live
npm run cli -- collect --source kozbeszerzes  --region all --live

# 3. THE EMAIL STEP — scrape email/phone off each lead's website.
npm run cli -- enrich --live

# 4. (optional) Fill remaining phone/website/address from Google Places (needs a key).
npm run cli -- places --live

# 5. (optional) Validate VAT / tax status.
npm run cli -- verify --live      # EU VIES
npm run cli -- nav    --live      # NAV tax status

# 6. Inspect coverage, then export the emailable, categorized leads.
npm run cli -- report
npm run cli -- export --min-quality 40 --out procura-export.ndjson
```

`refresh` does steps 1–5 in one shot (all non-gated sources + every enrichment),
resuming cursors:

```bash
npm run cli -- refresh --region all --live
```

Re-running is **idempotent**: leads merge on the dedupe key, paginated sources
resume from a saved cursor (use `--full` on `collect` to force a fresh scan).
Run `enrich`/`places`/`verify`/`nav` repeatedly — they only touch leads still
missing the relevant field (`--revalidate` re-checks already-checked ones).

## Command reference

| Command | `--region`? | `--live`? | Other flags | Purpose |
|---|---|---|---|---|
| `collect --source <id>` | **required** | yes | `--full`, `--limit N` | Fetch one source for region(s) |
| `refresh` | optional (default `all`) | yes | — | Collect all non-gated sources + all enrichment |
| `enrich` | no (all leads) | yes | `--limit N`, `--revalidate` | **Email/phone from each lead's website** |
| `places` | no (all leads) | yes | `--limit N`, `--revalidate` | Phone/website/address from Google Places |
| `verify` | no (all leads) | yes | `--limit N`, `--revalidate` | VAT validation via EU VIES |
| `nav` | no (all leads) | yes | `--limit N`, `--revalidate` | Tax status via NAV |
| `report` | no | — | — | Coverage / enrichment dashboard |
| `export` | no | — | `--out`, `--min-quality N`, `--approved`, `--include-personal` | NDJSON to Procura |
| `list` | filter | — | `--category`, `--min-quality N`, `--limit N` | Inspect leads |
| `stats` | no | — | — | Counts by region/category + cursors |
| `review queue` / `review approve\|reject <id>` | filter | — | `--note` | Manual approve/reject queue |
| `suppress <email\|domain>` | — | — | `--kind`, `--reason` | Do-not-collect list |
| `dsar export\|erase <email>` | — | — | — | GDPR access / erasure |
| `purge` | — | — | `--dry-run` | Delete suppressed + expired personal data |
| `ropa` | — | — | `--write` | Generate the Art. 30 record |

Note: only `collect` and `refresh` take `--region`. The enrichment steps scan
the whole lead table for rows missing the field they fill.

## Live mode: what each source needs

| Source | Live out of the box? | Notes |
|---|---|---|
| `overpass` | ✅ yes | Public Overpass API + mirror fallback. `overpass-api.de` is IPv6-only — on an IPv4-only host rely on `OVERPASS_MIRRORS` or set `OVERPASS_URL` to a mirror. |
| `enrich` | ✅ yes | Fetches each lead's own website; no endpoint to configure. Needs leads that already have a `website`. |
| `verify` (VIES) | ✅ yes | Public EU endpoint, no key. |
| `ebeszamolo`, `mkik`, `opencorporates`, `kozbeszerzes`, `nav` | ⚠ endpoint/credentials | Default to official URLs; several need an API key/registration before they return data. Verify the URL + auth for each. |
| `places` | ⚠ key required | Needs a Google Places API key and the request shape wired to your account. |
| `directory`, `htmldir` | ❌ no public default | Generic "bring-your-own-listing" connectors — see below. |
| `evny` (sole traders) | 🔒 gated | `EVNY_ENABLED=true` required; records are personal data. |

## `directory` and `htmldir`: bring your own listing

These two are **not** wired to any public Hungarian service. They are generic,
reusable connectors for a paginated business listing **you** choose to integrate.
That is why their defaults are placeholder URLs (`*.test`) and why running them
`--live` without configuration fails fast with a "set DIRECTORY_URL/…" message.

**`directory` — a paginated JSON API.** Set `DIRECTORY_URL` to the base URL. The
connector requests `${DIRECTORY_URL}?region=<regionId>&page=<n>` and expects:

```json
{ "results": [
  { "name": "...", "email": "...", "phone": "...", "website": "...",
    "address": "...", "vat": "...", "activity": "..." }
] }
```

Pagination stops at `DIRECTORY_MAX_PAGES` or when a page returns no results. If
the real API uses different field names or paging params, adapt
`src/lib/directoryParse.ts` and the `pageUrl` builder in
`src/connectors/directory.ts`.

**`htmldir` — a paginated HTML listing.** Set `HTML_DIRECTORY_URL`. The connector
requests `${HTML_DIRECTORY_URL}/<regionId>?p=<n>` and the parser
(`src/lib/htmlDirectoryParse.ts`) expects each business in a card element with
`class="biz"` and fields tagged by class (`name`, `cat`, `email` as a `mailto:`
link, `phone`, `web` link, `addr`). A real site won't match this markup — point
it at the listing and **adapt the selectors and the URL/region mapping** to that
site's HTML.

**Where do you get such a URL?** There is no official, ready-made one. Realistic
sources to integrate:

- Hungarian business directories / phone books (e.g. Aranyoldalak, Telefonkönyv)
  — HTML; use `htmldir` and adapt the selectors to their page structure.
- Company/industry databases or chamber listings that expose JSON — use
  `directory` and map the fields.
- Your own intermediate export/API that emits the JSON shape above.

Two honest caveats: (1) every such site has its own markup, so integrating one is
"set the URL **and** adapt the parser", not just an env change; (2) whether you
may scrape and use a given listing (its ToS / legal basis) is the operator's
call, handled outside this codebase (see `docs/SCOPE.md`).

**For the email goal, these are optional.** The biggest email lever needs no
extra endpoint: `overpass` discovers websites and `enrich` reads the emails off
them. Add `directory`/`htmldir` only when you have a specific listing worth the
integration.

## Tuning (env)

| Var | Default | Effect |
|---|---|---|
| `FETCH_CONCURRENCY` | `8` | Sources/pages/regions fetched in parallel (across hosts). |
| `MIN_REQUEST_INTERVAL_MS` | `1000` | Per-host minimum gap. Now enforced under concurrency; raise if a host still rate-limits, set `0` where allowed. |
| `FETCH_MAX_RETRIES` / `FETCH_BACKOFF_BASE_MS` | `3` / `500` | Transient-failure retries (honors `Retry-After`). |
| `FETCH_TIMEOUT_MS` | `15000` | Per-request timeout; a timed-out request is retried. Stops one hung site from stalling a run. `0` disables. |
| `FETCH_CACHE` | `true` | In-run response cache (dedupe identical fetches). |
| `OVERPASS_URL` | overpass-api.de | Primary Overpass endpoint. |
| `OVERPASS_MIRRORS` | kumi, openstreetmap.ru, mail.ru | Comma-separated fallback endpoints tried in order. |
| `DIRECTORY_URL` / `HTML_DIRECTORY_URL` | placeholders | Live endpoints for the generic listing connectors. |
| `WRITE_BATCH_SIZE` | `500` | DB bulk-insert batch size. |
| `RESPECT_ROBOTS` | `false` | Honor robots.txt (operator's choice). |
| `EVNY_ENABLED` | `false` | Enable the sole-trader connector (personal data). |

## Troubleshooting

- **`429` / `504` from Overpass under `--region all --live`.** The per-host
  throttle now spaces requests, and the connector falls back across mirrors, so
  this should be rare. If it persists, raise `MIN_REQUEST_INTERVAL_MS` (e.g.
  `2000`) and/or lower `FETCH_CONCURRENCY`.
- **`fetch failed` on Overpass with no data.** Likely IPv6-only DNS for
  `overpass-api.de` on a host without IPv6 routing (e.g. some WSL setups). Set
  `OVERPASS_URL` to an IPv4 mirror, or rely on `OVERPASS_MIRRORS`.
- **`source "directory"/"htmldir" has no live endpoint configured`.** Expected
  until you set `DIRECTORY_URL` / `HTML_DIRECTORY_URL` (see above). Drop `--live`
  to run against the bundled fixtures.
- **`stats --live` looks identical to `stats`.** Correct — `stats` only reads the
  DB; `--live` only matters for `collect`/`refresh`/`enrich`/`places`/`verify`/`nav`.
- **Few emails.** Run `enrich --live` after discovery; check `report` for the
  "contacts" enrichment count. Emails come from websites, so leads need a
  `website` first (overpass/places provide it).
- **`enrich --live` runs for a long time / no visible progress.** It now prints a
  progress line (`[done/total] … ~Ns left`) ~20 times during the run, fetches
  websites in concurrent windows (`FETCH_CONCURRENCY`), and times out hung sites
  (`FETCH_TIMEOUT_MS`). It scans the whole lead table (it ignores `--region`); use
  `--limit N` to process a slice first, or raise `FETCH_CONCURRENCY` to go faster.
- **`Cannot find native binding` (vitest) / esbuild platform error / Prisma
  engine not found.** node_modules/Prisma client were built for another OS — see
  the Windows + WSL note under Setup.
