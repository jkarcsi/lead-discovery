export const config = {
  userAgent: process.env.CRAWLER_USER_AGENT || "ProcuraLeadBot/0.1",
  contactUrl: process.env.CRAWLER_CONTACT_URL || "",
  overpassUrl: process.env.OVERPASS_URL || "https://overpass-api.de/api/interpreter",
  viesUrl:
    process.env.VIES_URL ||
    "https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number",
  directoryUrl: process.env.DIRECTORY_URL || "https://example-directory.test/api",
  htmlDirectoryUrl: process.env.HTML_DIRECTORY_URL || "https://example-listing.test",
  directoryMaxPages: Number(process.env.DIRECTORY_MAX_PAGES || 50),

  // --- Throughput knobs (the whole point: collect fast and reliably) ---
  // Per-host minimum gap between requests. Tunable; the default keeps us under
  // the radar of rate-limiters so we don't get IP-banned mid-crawl (a ban costs
  // far more throughput than the wait). Set to 0 for sources that allow it.
  minRequestIntervalMs: Number(process.env.MIN_REQUEST_INTERVAL_MS || 1000),
  // How many sources/pages to fetch+parse in parallel.
  fetchConcurrency: Number(process.env.FETCH_CONCURRENCY || 8),
  // Transient-failure retries with exponential backoff (resilience = throughput:
  // a flaky 503 shouldn't drop a record).
  fetchMaxRetries: Number(process.env.FETCH_MAX_RETRIES || 3),
  fetchBackoffBaseMs: Number(process.env.FETCH_BACKOFF_BASE_MS || 500),
  // Cache identical fetches within a run to avoid redundant network round-trips.
  fetchCacheEnabled: process.env.FETCH_CACHE !== "false",
  // Honor robots.txt only when explicitly asked (operator's call; off by default
  // so collection isn't blocked — usage legality is handled separately).
  respectRobots: process.env.RESPECT_ROBOTS === "true",
  // DB write batch size for bulk inserts.
  writeBatchSize: Number(process.env.WRITE_BATCH_SIZE || 500),

  // --- Optional operator utilities (retention / review windows) ---
  personalDataRetentionDays: Number(process.env.PERSONAL_DATA_RETENTION_DAYS || 365),
  outreachEnabled: process.env.OUTREACH_ENABLED === "true",
  controllerName: process.env.ROPA_CONTROLLER_NAME || "Procura (operator)",
  controllerContact: process.env.ROPA_CONTROLLER_CONTACT || "ops@procura.hu",
  controllerDpo: process.env.ROPA_DPO_CONTACT || "n/a",
};

