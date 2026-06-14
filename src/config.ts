export const config = {
  userAgent: process.env.CRAWLER_USER_AGENT || "ProcuraLeadBot/0.1",
  contactUrl: process.env.CRAWLER_CONTACT_URL || "",
  overpassUrl: process.env.OVERPASS_URL || "https://overpass-api.de/api/interpreter",
  minRequestIntervalMs: Number(process.env.MIN_REQUEST_INTERVAL_MS || 1500),
  // Storage limitation (GDPR Art. 5(1)(e)): never-engaged personal-data leads
  // are purged after this many days by the retention job. See docs/LEGAL.md.
  personalDataRetentionDays: Number(process.env.PERSONAL_DATA_RETENTION_DAYS || 365),
  // Outreach stays disabled until counsel sign-off (see docs/LEGAL.md).
  outreachEnabled: process.env.OUTREACH_ENABLED === "true",
};
