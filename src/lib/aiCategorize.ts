// Pure helpers for AI categorization (no I/O). The model classifies a business's
// own website text into Procura categories when the rule-based categorizer found
// nothing — the cheapest AI path: Claude Haiku via the Batches API, structured
// outputs constrained to the taxonomy enum, and a stable (cacheable) prompt
// prefix. Everything here is deterministic so it can be unit-tested and so the
// system prompt is byte-stable for prompt caching.

import { CATEGORIES } from "../taxonomy.js";

// Valid choices the model may return: the taxonomy ids plus a "none" sentinel.
export const AI_CATEGORY_IDS = CATEGORIES.map((c) => c.id);
export const AI_NONE = "none";

export type AiConfidence = "high" | "low";
export type AiCategorization = { categories: string[]; confidence: AiConfidence };

// JSON Schema for structured outputs — constrains the response to the taxonomy
// enum so the model cannot invent a category. Kept within the documented
// structured-output subset (enums + basic arrays; no min/max constraints).
export function aiOutputSchema(): Record<string, unknown> {
  return {
    type: "object",
    properties: {
      categories: {
        type: "array",
        items: { type: "string", enum: [...AI_CATEGORY_IDS, AI_NONE] },
      },
      confidence: { type: "string", enum: ["high", "low"] },
    },
    required: ["categories", "confidence"],
    additionalProperties: false,
  };
}

// Stable system prompt: taxonomy + instructions. Deterministic and free of any
// per-request data so it forms a cacheable prefix across every lead in a batch.
// (With only six short categories it sits below Haiku's cache minimum, so caching
// is a no-op today; the structure keeps the win automatic if the prompt grows.)
export function buildSystemPrompt(): string {
  const lines = CATEGORIES.map(
    (c) => `- ${c.id}: ${c.name} — e.g. ${c.keywords.slice(0, 4).join(", ")}`,
  );
  return [
    "You classify a Hungarian business into Procura's service categories from its own website text.",
    "Pick only categories the business clearly PROVIDES AS A SERVICE — a passing mention of a topic does not qualify.",
    "A business may fit several categories, one, or none.",
    "",
    "Categories:",
    ...lines,
    "",
    `If none clearly apply, return ["${AI_NONE}"].`,
    'Set confidence "low" when the text is thin, generic, or ambiguous; "high" only when the services are explicit.',
  ].join("\n");
}

// The user turn for one lead: its website/classification text, bounded so a
// pathological page can't blow up the request.
export function buildUserPrompt(text: string, maxLen = 2000): string {
  return `Website text:\n${text.slice(0, maxLen).trim()}`;
}

// Validate a raw model result into clean taxonomy ids. Drops the "none" sentinel
// and anything outside the taxonomy; defaults to low confidence when unclear.
export function parseAiResult(raw: unknown): AiCategorization {
  const obj = (raw ?? {}) as { categories?: unknown; confidence?: unknown };
  const valid = new Set(AI_CATEGORY_IDS);
  const categories = Array.isArray(obj.categories)
    ? [...new Set(obj.categories.filter((c): c is string => typeof c === "string" && valid.has(c)))]
    : [];
  const confidence: AiConfidence = obj.confidence === "high" ? "high" : "low";
  return { categories, confidence };
}
