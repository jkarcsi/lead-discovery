import { describe, it, expect } from "vitest";
import {
  AI_CATEGORY_IDS,
  AI_NONE,
  aiOutputSchema,
  buildSystemPrompt,
  buildUserPrompt,
  parseAiResult,
} from "../src/lib/aiCategorize.js";
import { classifyLeads } from "../src/connectors/aiClient.js";
import { CATEGORIES } from "../src/taxonomy.js";

describe("aiOutputSchema", () => {
  it("constrains categories to the taxonomy enum plus the none sentinel", () => {
    const schema = aiOutputSchema() as any;
    const allowed = schema.properties.categories.items.enum as string[];
    for (const c of CATEGORIES) expect(allowed).toContain(c.id);
    expect(allowed).toContain(AI_NONE);
    expect(schema.properties.confidence.enum).toEqual(["high", "low"]);
    expect(schema.additionalProperties).toBe(false);
  });
});

describe("buildSystemPrompt", () => {
  it("is deterministic (byte-stable for prompt caching) and lists every category", () => {
    expect(buildSystemPrompt()).toBe(buildSystemPrompt());
    const sys = buildSystemPrompt();
    for (const c of CATEGORIES) expect(sys).toContain(c.id);
  });
});

describe("buildUserPrompt", () => {
  it("bounds the website text", () => {
    const long = "x".repeat(5000);
    expect(buildUserPrompt(long, 100).length).toBeLessThanOrEqual(100 + 20); // + the small label
  });
});

describe("parseAiResult", () => {
  it("keeps only valid taxonomy ids, deduped", () => {
    const r = parseAiResult({ categories: ["fire-safety", "fire-safety", "bogus"], confidence: "high" });
    expect(r).toEqual({ categories: ["fire-safety"], confidence: "high" });
  });
  it("drops the none sentinel to an empty list", () => {
    expect(parseAiResult({ categories: [AI_NONE], confidence: "high" }).categories).toEqual([]);
  });
  it("defaults to low confidence on anything but an explicit 'high'", () => {
    expect(parseAiResult({ categories: [], confidence: "medium" }).confidence).toBe("low");
    expect(parseAiResult({}).confidence).toBe("low");
    expect(parseAiResult(null).categories).toEqual([]);
  });
  it("every taxonomy id round-trips", () => {
    for (const id of AI_CATEGORY_IDS) {
      expect(parseAiResult({ categories: [id], confidence: "high" }).categories).toEqual([id]);
    }
  });
});

describe("classifyLeads (offline fixture)", () => {
  it("resolves results by stable key, defaulting unknown leads to low/none", async () => {
    const out = await classifyLeads(
      [
        { id: "a", key: "Lánghír Tűzmegelőzési Iroda", text: "tűzvédelem..." },
        { id: "b", key: "Nincs Ilyen Cég", text: " smms" },
      ],
      { live: false },
    );
    expect(out.get("a")).toEqual({ categories: ["fire-safety"], confidence: "high" });
    // Unknown key → low-confidence, no category (so the pipeline marks it checked
    // without inventing a category).
    expect(out.get("b")).toEqual({ categories: [], confidence: "low" });
  });
});
