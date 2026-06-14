import { describe, it, expect } from "vitest";
import { planIngest } from "../src/lib/ingestPlan.js";
import type { LeadInput } from "../src/types.js";

function lead(overrides: Partial<LeadInput> = {}): LeadInput {
  return {
    legalName: "Acme Kft.",
    email: null,
    phone: null,
    website: null,
    domain: null,
    address: null,
    vatNumber: null,
    registrationNumber: null,
    regionId: "budapest",
    categories: [],
    source: "overpass",
    isPersonalData: false,
    ...overrides,
  };
}

describe("planIngest", () => {
  it("collapses duplicates sharing a dedupe identity, tracking inputCount", () => {
    const plan = planIngest(
      [
        lead({ legalName: "Tiszta Iroda Kft.", vatNumber: "10773381" }),
        lead({ legalName: "Tiszta Iroda Kft.", vatNumber: "10773381", phone: "+36301112233" }),
      ],
      new Set(),
    );
    expect(plan.items).toHaveLength(1);
    expect(plan.items[0].inputCount).toBe(2);
    // merge keeps the first record's identity but fills gaps from the second.
    expect(plan.items[0].lead.phone).toBe("+36301112233");
  });

  it("keeps distinct identities separate", () => {
    const plan = planIngest(
      [lead({ domain: "a.hu" }), lead({ domain: "b.hu" })],
      new Set(),
    );
    expect(plan.items).toHaveLength(2);
  });

  it("drops suppressed leads up front and counts them", () => {
    const plan = planIngest(
      [
        lead({ domain: "blocked.hu", email: "x@blocked.hu" }),
        lead({ domain: "ok.hu" }),
      ],
      new Set(["blocked.hu"]),
    );
    expect(plan.suppressedCount).toBe(1);
    expect(plan.items).toHaveLength(1);
    expect(plan.items[0].lead.domain).toBe("ok.hu");
  });

  it("is empty for an empty batch", () => {
    expect(planIngest([], new Set())).toEqual({ items: [], suppressedCount: 0 });
  });
});
