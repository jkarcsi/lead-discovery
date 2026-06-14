import { describe, it, expect } from "vitest";
import {
  isExpiredPersonalLead,
  isLeadSuppressed,
  purgeReason,
  DEFAULT_RETENTION,
  type RetentionLead,
} from "../src/lib/retention.js";

const NOW = new Date("2026-06-14T00:00:00Z");
const monthsAgo = (n: number) => new Date(NOW.getTime() - n * 30.437 * 24 * 60 * 60 * 1000);

const base: RetentionLead = {
  isPersonalData: false,
  lifecycle: "NEW",
  collectedAt: monthsAgo(0),
  email: null,
  domain: null,
};

describe("isExpiredPersonalLead", () => {
  it("purges never-engaged personal-data leads past the horizon", () => {
    const lead = { ...base, isPersonalData: true, collectedAt: monthsAgo(13) };
    expect(isExpiredPersonalLead(lead, NOW)).toBe(true);
  });
  it("keeps personal-data leads still within the horizon", () => {
    const lead = { ...base, isPersonalData: true, collectedAt: monthsAgo(6) };
    expect(isExpiredPersonalLead(lead, NOW)).toBe(false);
  });
  it("never purges business (non-personal) data on retention grounds", () => {
    const lead = { ...base, isPersonalData: false, collectedAt: monthsAgo(60) };
    expect(isExpiredPersonalLead(lead, NOW)).toBe(false);
  });
  it("keeps engaged personal-data leads regardless of age", () => {
    const lead = { ...base, isPersonalData: true, lifecycle: "RESPONDED", collectedAt: monthsAgo(60) };
    expect(isExpiredPersonalLead(lead, NOW)).toBe(false);
  });
  it("respects a custom horizon", () => {
    const lead = { ...base, isPersonalData: true, collectedAt: monthsAgo(4) };
    expect(isExpiredPersonalLead(lead, NOW, { personalDataMaxAgeMonths: 3 })).toBe(true);
  });
});

describe("isLeadSuppressed", () => {
  const emails = new Set(["info@opted-out.hu"]);
  const domains = new Set(["blocked.hu"]);

  it("matches an exact suppressed email (case-insensitive)", () => {
    expect(isLeadSuppressed({ email: "INFO@opted-out.hu", domain: null }, emails, domains)).toBe(true);
  });
  it("matches a lead whose email domain is suppressed", () => {
    expect(isLeadSuppressed({ email: "sales@blocked.hu", domain: null }, emails, domains)).toBe(true);
  });
  it("matches a lead whose website domain is suppressed", () => {
    expect(isLeadSuppressed({ email: null, domain: "blocked.hu" }, emails, domains)).toBe(true);
  });
  it("does not match an unrelated lead", () => {
    expect(isLeadSuppressed({ email: "info@fine.hu", domain: "fine.hu" }, emails, domains)).toBe(false);
  });
});

describe("purgeReason", () => {
  const emails = new Set<string>();
  const domains = new Set(["blocked.hu"]);

  it("returns suppressed when contact is on the list (precedence over age)", () => {
    const lead = { ...base, isPersonalData: true, collectedAt: monthsAgo(60), domain: "blocked.hu" };
    expect(purgeReason(lead, NOW, DEFAULT_RETENTION, emails, domains)).toBe("suppressed");
  });
  it("returns retention_expired for an aged never-engaged personal lead", () => {
    const lead = { ...base, isPersonalData: true, collectedAt: monthsAgo(18) };
    expect(purgeReason(lead, NOW, DEFAULT_RETENTION, emails, domains)).toBe("retention_expired");
  });
  it("returns null for a fresh business lead", () => {
    const lead = { ...base, collectedAt: monthsAgo(1) };
    expect(purgeReason(lead, NOW, DEFAULT_RETENTION, emails, domains)).toBe(null);
  });
});
