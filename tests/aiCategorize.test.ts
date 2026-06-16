import { describe, it, expect } from "vitest";
import {
  AI_PROMPT_VERSION,
  categorizationSchema,
  buildSystemPrompt,
  buildLeadText,
  buildRequestParams,
  parseDecision,
} from "../src/lib/aiCategorize.js";
import { CATEGORIES, REGIONS } from "../src/taxonomy.js";

const CATEGORY_IDS = CATEGORIES.map((c) => c.id);
const REGION_IDS = REGIONS.map((r) => r.id);

describe("categorizationSchema", () => {
  it("constrains category/region values to the taxonomy (structured outputs)", () => {
    const schema = categorizationSchema() as any;
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toEqual(["categoryIds", "regionId", "confidence"]);
    expect(schema.properties.categoryIds.items.enum).toEqual(CATEGORY_IDS);
    // regionId is a taxonomy id OR null.
    const regionEnum = schema.properties.regionId.anyOf[0].enum;
    expect(regionEnum).toEqual(REGION_IDS);
    expect(schema.properties.regionId.anyOf[1].type).toBe("null");
  });
});

describe("buildSystemPrompt", () => {
  it("is a stable, cacheable prefix listing every taxonomy id", () => {
    const p = buildSystemPrompt();
    for (const id of CATEGORY_IDS) expect(p).toContain(id);
    for (const id of REGION_IDS) expect(p).toContain(id);
    // Stable across calls (so it caches).
    expect(buildSystemPrompt()).toBe(p);
  });
});

describe("buildLeadText", () => {
  it("includes the available per-lead fields and bounds length", () => {
    const text = buildLeadText({
      legalName: "Példa Kft.",
      brandName: "Példa",
      address: "1054 Budapest",
      classificationText: "irodatakarítás",
      websiteText: "Takarítási szolgáltatások cégeknek.",
    });
    expect(text).toContain("Példa Kft.");
    expect(text).toContain("1054 Budapest");
    expect(text).toContain("Website:");
    expect(text.length).toBeLessThanOrEqual(4000);
  });
  it("omits absent fields", () => {
    const text = buildLeadText({ legalName: "Csak Név Kft." });
    expect(text).toContain("Csak Név Kft.");
    expect(text).not.toContain("Website:");
    expect(text).not.toContain("Listing:");
  });
});

describe("buildRequestParams", () => {
  it("uses the given model, a cached taxonomy prefix, and structured outputs", () => {
    const params = buildRequestParams({
      model: "claude-haiku-4-5",
      maxTokens: 512,
      input: { legalName: "Teszt Kft.", classificationText: "klíma szerelés" },
    });
    expect(params.model).toBe("claude-haiku-4-5");
    expect(params.max_tokens).toBe(512);
    // System prefix carries the cache_control breakpoint.
    const sys = params.system as any[];
    expect(sys[0].cache_control).toEqual({ type: "ephemeral" });
    // Structured output format → json_schema.
    expect((params.output_config as any).format.type).toBe("json_schema");
    // Per-lead text is the user turn.
    expect(params.messages[0].role).toBe("user");
    expect(params.messages[0].content).toContain("Teszt Kft.");
  });
});

describe("parseDecision", () => {
  const known = CATEGORY_IDS[0];

  it("keeps only in-taxonomy ids and de-dupes", () => {
    const d = parseDecision({ categoryIds: [known, "not-a-category", known], regionId: "budapest", confidence: 0.9 });
    expect(d).not.toBeNull();
    expect(d!.categoryIds).toEqual([known]);
    expect(d!.regionId).toBe("budapest");
    expect(d!.confidence).toBe(0.9);
  });

  it("coerces unknown / missing region to null", () => {
    expect(parseDecision({ categoryIds: [], regionId: "atlantis", confidence: 0.5 })!.regionId).toBeNull();
    expect(parseDecision({ categoryIds: [], regionId: null, confidence: 0.5 })!.regionId).toBeNull();
  });

  it("clamps confidence to [0,1] and defaults bad values to 0", () => {
    expect(parseDecision({ categoryIds: [], regionId: null, confidence: 2 })!.confidence).toBe(1);
    expect(parseDecision({ categoryIds: [], regionId: null, confidence: -3 })!.confidence).toBe(0);
    expect(parseDecision({ categoryIds: [], regionId: null, confidence: "x" })!.confidence).toBe(0);
  });

  it("parses a JSON string payload", () => {
    const d = parseDecision(JSON.stringify({ categoryIds: [known], regionId: "pest", confidence: 0.7 }));
    expect(d!.categoryIds).toEqual([known]);
    expect(d!.regionId).toBe("pest");
  });

  it("returns null on unusable input", () => {
    expect(parseDecision("not json")).toBeNull();
    expect(parseDecision(null)).toBeNull();
    expect(parseDecision(42)).toBeNull();
  });
});

describe("AI_PROMPT_VERSION", () => {
  it("is a non-empty stable identifier", () => {
    expect(typeof AI_PROMPT_VERSION).toBe("string");
    expect(AI_PROMPT_VERSION.length).toBeGreaterThan(0);
  });
});
