export const config = {
  userAgent: process.env.CRAWLER_USER_AGENT || "ProcuraLeadBot/0.1",
  contactUrl: process.env.CRAWLER_CONTACT_URL || "",
  overpassUrl: process.env.OVERPASS_URL || "https://overpass-api.de/api/interpreter",
  viesUrl:
    process.env.VIES_URL ||
    "https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number",
  minRequestIntervalMs: Number(process.env.MIN_REQUEST_INTERVAL_MS || 1500),
  // Storage limitation (GDPR Art. 5(1)(e)): never-engaged personal-data leads
  // are purged after this many days by the retention job. See docs/LEGAL.md.
  personalDataRetentionDays: Number(process.env.PERSONAL_DATA_RETENTION_DAYS || 365),
  // Outreach stays disabled until counsel sign-off (see docs/LEGAL.md).
  outreachEnabled: process.env.OUTREACH_ENABLED === "true",
  // Art. 30 record-of-processing controller details (placeholders until counsel
  // confirms the controller/DPO; override via env).
  controllerName: process.env.ROPA_CONTROLLER_NAME || "Procura (operator) — TBD with counsel",
  controllerContact: process.env.ROPA_CONTROLLER_CONTACT || "privacy@procura.hu (placeholder)",
  controllerDpo: process.env.ROPA_DPO_CONTACT || "No DPO appointed yet — assess need (Art. 37)",
};
