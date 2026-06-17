export const config = {
  userAgent: process.env.CRAWLER_USER_AGENT || "ProcuraLeadBot/0.1",
  contactUrl: process.env.CRAWLER_CONTACT_URL || "",
  overpassUrl: process.env.OVERPASS_URL || "https://overpass-api.de/api/interpreter",
  // Public Overpass mirrors, tried in order after the primary endpoint. The
  // public API rate-limits (429) and times out (504) under load; rotating to a
  // mirror turns a failed region into a retry elsewhere. Override/extend via
  // OVERPASS_MIRRORS (comma-separated). De-duped against overpassUrl at use.
  overpassMirrors: (
    process.env.OVERPASS_MIRRORS ||
    "https://overpass.kumi.systems/api/interpreter,https://overpass.openstreetmap.ru/api/interpreter,https://maps.mail.ru/osm/tools/overpass/api/interpreter"
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  viesUrl:
    process.env.VIES_URL ||
    "https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number",
  directoryUrl: process.env.DIRECTORY_URL || "https://example-directory.test/api",
  htmlDirectoryUrl: process.env.HTML_DIRECTORY_URL || "https://example-listing.test",
  // Company registry (Céginformációs Szolgálat / e-beszámoló). The free
  // e-cegjegyzek.hu lookup is CAPTCHA-gated and its ToS forbids automated/bulk
  // access — bulk data requires a usage agreement (contract) or a licensed API
  // (e.g. Cégadat API). Set EBESZAMOLO_URL to your contracted endpoint and
  // EBESZAMOLO_LICENSED=true to confirm you may collect it. Default is a
  // placeholder so an unconfigured live run fails fast.
  ebeszamoloUrl: process.env.EBESZAMOLO_URL || "https://your-licensed-cegadat-endpoint.invalid/api",
  ebeszamoloLicensed: process.env.EBESZAMOLO_LICENSED === "true",
  evnyUrl: process.env.EVNY_URL || "https://www.nyilvantarto.hu/evny/api",
  navUrl: process.env.NAV_URL || "https://api.nav.gov.hu/taxpayer",
  kozbeszerzesUrl: process.env.KOZBESZERZES_URL || "https://ekr.gov.hu/api/ertesito",
  mkikUrl: process.env.MKIK_URL || "https://kamreg.mkik.hu/api",
  openCorporatesUrl: process.env.OPENCORPORATES_URL || "https://api.opencorporates.com/v0.4/companies/hu",
  placesUrl: process.env.PLACES_URL || "https://places.googleapis.com/v1/places:searchText",
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
  // Per-request timeout. Without it a single hung/slow site (common when scraping
  // contact pages) can stall a whole sequential run indefinitely. A timed-out
  // request is treated as a transient failure and retried. 0 disables.
  fetchTimeoutMs: Number(process.env.FETCH_TIMEOUT_MS || 15000),
  // Cache identical fetches within a run to avoid redundant network round-trips.
  fetchCacheEnabled: process.env.FETCH_CACHE !== "false",
  // EVNY (sole-trader registry) is sensitive personal data — collection is OFF
  // unless the operator explicitly enables it.
  evnyEnabled: process.env.EVNY_ENABLED === "true",

  // --- AI categorization (Claude Haiku via the Batches API) ---
  // Classifies website text the rule-based categorizer couldn't. Live mode needs
  // an API key; offline it reads a fixture so tests stay key-free. Haiku 4.5 is
  // the cheapest model that supports structured outputs (the taxonomy enum).
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
  aiModel: process.env.AI_CATEGORIZE_MODEL || "claude-haiku-4-5",
  // Poll interval / ceiling while waiting for an async batch to finish.
  aiPollIntervalMs: Number(process.env.AI_POLL_INTERVAL_MS || 10000),
  aiPollMaxMs: Number(process.env.AI_POLL_MAX_MS || 24 * 60 * 60 * 1000),
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

