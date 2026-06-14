import { describe, it, expect } from "vitest";
import {
  purgeDecision,
  type RetentionLeadView,
  type PurgeReason,
} from "../src/lib/retention.js";

const NOW = new Date("2026-06-14T00:00:00Z");
const POLICY = { personalDataRetentionDays: 365 };

function lead(overrides: Partial<RetentionLeadView> = {}): RetentionLeadView {
  return {
    email: null,
    domain: null,
    isPersonalData: false,
    lifecycle: "NEW",
    collectedAt: NOW, // fresh by default
    ...overrides,
  };
}

function decide(
  l: RetentionLeadView,
  suppressed: string[] = [],
): PurgeReason | null {
  return purgeDecision(l, {
    suppressedValues: new Set(suppressed),
    policy: POLICY,
    now: NOW,
  });
}

describe("purgeDecision — suppression", () => {
  it("purges a lead whose email is now suppressed", () => {
    expect(decide(lead({ email: "info@acme.hu" }), ["info@acme.hu"])).toBe("SUPPRESSED");
  });

  it("matches suppression case-insensitively / trimmed", () => {
    expect(decide(lead({ email: "  INFO@Acme.HU " }), ["info@acme.hu"])).toBe("SUPPRESSED");
  });

  it("purges when the email's domain is suppressed", () => {
    expect(decide(lead({ email: "sales@acme.hu" }), ["acme.hu"])).toBe("SUPPRESSED");
  });

  it("purges when the website domain is suppressed", () => {
    expect(decide(lead({ domain: "acme.hu" }), ["acme.hu"])).toBe("SUPPRESSED");
  });

  it("keeps a lead with no suppression match", () => {
    expect(decide(lead({ email: "info@acme.hu", domain: "acme.hu" }), ["other.hu"])).toBeNull();
  });

  it("suppression beats type/age — even a fresh company lead is purged", () => {
    expect(decide(lead({ email: "a@b.hu", isPersonalData: false }), ["a@b.hu"])).toBe("SUPPRESSED");
  });
});

describe("purgeDecision — personal-data retention", () => {
  const old = new Date(NOW.getTime() - 400 * 86_400_000); // > 365 days
  const recent = new Date(NOW.getTime() - 100 * 86_400_000); // < 365 days

  it("purges a never-engaged personal-data lead past the window", () => {
    expect(decide(lead({ isPersonalData: true, lifecycle: "NEW", collectedAt: old }))).toBe(
      "PERSONAL_DATA_EXPIRED",
    );
  });

  it("keeps a personal-data lead still inside the window", () => {
    expect(decide(lead({ isPersonalData: true, lifecycle: "NEW", collectedAt: recent }))).toBeNull();
  });

  it("keeps an old personal-data lead that has engaged", () => {
    expect(
      decide(lead({ isPersonalData: true, lifecycle: "RESPONDED", collectedAt: old })),
    ).toBeNull();
  });

  it("retention does not apply to non-personal (company) leads", () => {
    expect(
      decide(lead({ isPersonalData: false, lifecycle: "NEW", collectedAt: old })),
    ).toBeNull();
  });

  it("purges exactly at the retention boundary", () => {
    const boundary = new Date(NOW.getTime() - 365 * 86_400_000);
    expect(
      decide(lead({ isPersonalData: true, lifecycle: "NEW", collectedAt: boundary })),
    ).toBe("PERSONAL_DATA_EXPIRED");
  });
});
