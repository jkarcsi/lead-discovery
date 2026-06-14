import { describe, it, expect } from "vitest";
import {
  decisionToStatus,
  reviewReasons,
  queueComparator,
  type ReviewLeadView,
} from "../src/lib/review.js";

function lead(overrides: Partial<ReviewLeadView> = {}): ReviewLeadView {
  return {
    email: "info@acme.hu",
    phone: "+36301234567",
    categories: ["cleaning"],
    qualityScore: 80,
    isPersonalData: false,
    ...overrides,
  };
}

describe("decisionToStatus", () => {
  it("maps approve/reject to statuses", () => {
    expect(decisionToStatus("approve")).toBe("APPROVED");
    expect(decisionToStatus("reject")).toBe("REJECTED");
  });
  it("throws on anything else", () => {
    expect(() => decisionToStatus("maybe")).toThrow(/Unknown review action/i);
  });
});

describe("reviewReasons", () => {
  it("returns no reasons for a clean, ready business lead", () => {
    expect(reviewReasons(lead())).toEqual([]);
  });

  it("flags personal-data leads", () => {
    expect(reviewReasons(lead({ isPersonalData: true }))[0]).toMatch(/personal data/i);
  });

  it("flags missing contact channel", () => {
    expect(reviewReasons(lead({ email: null, phone: null }))).toContain("no contact channel");
  });

  it("flags uncategorized leads", () => {
    expect(reviewReasons(lead({ categories: [] }))).toContain("uncategorized");
  });

  it("flags low quality", () => {
    expect(reviewReasons(lead({ qualityScore: 20 })).some((r) => r.includes("low quality"))).toBe(
      true,
    );
  });

  it("can report several reasons at once", () => {
    const r = reviewReasons(lead({ isPersonalData: true, email: null, phone: null, qualityScore: 10, categories: [] }));
    expect(r).toHaveLength(4);
  });
});

describe("queueComparator", () => {
  it("orders higher quality first among company leads", () => {
    const items = [lead({ qualityScore: 30 }), lead({ qualityScore: 90 }), lead({ qualityScore: 60 })];
    const sorted = [...items].sort(queueComparator).map((l) => l.qualityScore);
    expect(sorted).toEqual([90, 60, 30]);
  });

  it("groups personal-data leads after equal company leads", () => {
    const company = lead({ qualityScore: 50, isPersonalData: false });
    const personal = lead({ qualityScore: 90, isPersonalData: true });
    expect([personal, company].sort(queueComparator)).toEqual([company, personal]);
  });
});
