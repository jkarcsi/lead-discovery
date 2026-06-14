export const config = {
  userAgent: process.env.CRAWLER_USER_AGENT || "ProcuraLeadBot/0.1",
  contactUrl: process.env.CRAWLER_CONTACT_URL || "",
  overpassUrl: process.env.OVERPASS_URL || "https://overpass-api.de/api/interpreter",
  // EU VIES VAT-number validation (official service; used for verification).
  viesUrl:
    process.env.VIES_URL ||
    "https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number",
  minRequestIntervalMs: Number(process.env.MIN_REQUEST_INTERVAL_MS || 1500),
  // How long a VAT verification stays fresh before re-checking (days).
  verifyTtlDays: Number(process.env.VERIFY_TTL_DAYS || 90),
  // Outreach stays disabled until counsel sign-off (see docs/LEGAL.md).
  outreachEnabled: process.env.OUTREACH_ENABLED === "true",
};
