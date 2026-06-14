# Scope

This project is a **data-collection engine**. Its single goal is to gather
Hungarian business data from the best available sources — fast, broadly, and
reliably — into one categorized, deduplicated database aligned to Procura's
taxonomy.

**Out of scope here:** the legality of acquiring and using the data. That is
handled separately by the operator (legal review and a different project). This
codebase does not implement consent/lawful-basis machinery and does not gate
collection on it.

## Technical defaults we keep (because they make scraping work better)

These are throughput/reliability features, not compliance gestures:

- **Identified User-Agent** (`CRAWLER_USER_AGENT`) — many hosts block blank/odd
  agents; a stable identified one is less likely to be thrown a 403.
- **Tunable per-host rate limit** (`MIN_REQUEST_INTERVAL_MS`, default 1000ms; set
  to 0 where allowed) — staying under a rate-limiter avoids the IP ban that would
  cost far more throughput than the wait.
- **Retries with exponential backoff** (`FETCH_MAX_RETRIES`) — a transient 503 or
  network blip shouldn't drop a record.
- **In-run response cache** (`FETCH_CACHE`) — never fetch the same URL twice.
- **Concurrency** (`FETCH_CONCURRENCY`) — the network is the bottleneck.
- **robots.txt** is honored **only** if the operator opts in (`RESPECT_ROBOTS`);
  off by default.

## What we deliberately don't build

Things that get a scraper *blocked* rather than *faster*, and that the operator
hasn't asked for: authentication/paywall/CAPTCHA bypass, and proxy-rotation /
fingerprint-spoofing aimed at evading bans. Adding sources, parsers,
concurrency, pagination, and batching is the way to go faster.

## Optional operator utilities (already present, not a focus)

`suppress` / `purge` (a do-not-collect list + retention window), `dsar`, and
`ropa` exist if the operator wants them, but the project's development focus is
collection throughput and coverage.
