// Pure (no I/O) core of the low-cost AI categorization path described in
// IMPLEMENTATION_PLAN.md §9.1. Rules run first (src/lib/categorize.ts); only the
// leads whose operating area rules CAN'T resolve reach here. For that residual we
// ask Claude — the cheapest way possible:
//
//   • Model: Claude Haiku 4.5 (cheapest current model) — see config.aiModel.
//   • Message Batches API (50% off) — categorization is an offline, non-latency-
//     sensitive enrichment job, so the pipeline submits leads as one batch.
//   • Prompt caching — the taxonomy + instructions + output schema are a stable
//     prefix (placed in `system` behind a cache_control breakpoint); only the
//     per-lead text is the varying suffix. (Haiku's min cacheable prefix is 4096
//     tokens; this small taxonomy may sit under it, in which case the API simply
//     won't cache — the breakpoint is correct and harmless either way.)
//   • Structured outputs — the response is constrained to a fixed JSON schema
//     whose category/region values are drawn from the taxonomy enum, so results
//     are always in-taxonomy with no free-text parsing.
//
// This module owns everything that is decidable without a network or a key:
// the prompt, the schema, the request shape, and the response parser. The
// pipeline (src/pipeline/aiCategorize.ts) owns the I/O and the store-once gate.

import type Anthropic from "@anthropic-ai/sdk";
import { CATEGORIES, REGIONS } from "../taxonomy.js";

// Bump when the taxonomy, the instructions, or the schema change in a way that
// should invalidate previously-stored AI decisions. Persisted on the Lead so
// `ai-categorize --revalidate` (or a future auto-recheck) knows a decision is
// stale and worth re-paying for. Computing once and storing is the whole point:
// each business is categorized once and never re-paid unless this bumps.
export const AI_PROMPT_VERSION = "ai-cat-v1";

const CATEGORY_IDS = CATEGORIES.map((c) => c.id);
const REGION_IDS = REGIONS.map((r) => r.id);

// What the categorizer needs about a lead. Mirrors the rule-based categorizer's
// inputs (classificationText, name, address) plus any scraped website text — the
// design promotes a business's own site to a primary, categorizable signal.
export type AiLeadInput = {
  legalName: string;
  brandName?: string | null;
  address?: string | null;
  classificationText?: string | null;
  websiteText?: string | null;
};

// The constrained decision the model returns (after defensive parsing).
export type AiDecision = {
  categoryIds: string[]; // subset of the taxonomy; may be empty (none apply)
  regionId: string | null; // a taxonomy region id, or null if undeterminable
  confidence: number; // 0..1; low-confidence is held for manual review
};

// Keep per-lead input bounded: a homepage + a couple of subpages is plenty to
// classify into six buckets, and it caps token spend per lead.
const MAX_TEXT_CHARS = 4000;

// The structured-output contract: a fixed shape whose category/region values are
// drawn straight from the taxonomy, so the model can only ever return in-taxonomy
// ids. (Structured outputs don't support numeric bounds, so `confidence` is a
// plain number and we clamp it on the way in — see parseDecision.)
export function categorizationSchema(): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      categoryIds: {
        type: "array",
        description: "Every taxonomy category id that clearly applies; [] if none do.",
        items: { type: "string", enum: CATEGORY_IDS },
      },
      regionId: {
        description: "The taxonomy region id of the business's seat, or null if undeterminable.",
        anyOf: [{ type: "string", enum: REGION_IDS }, { type: "null" }],
      },
      confidence: {
        type: "number",
        description: "Confidence in the categoryIds, 0 (guess) to 1 (certain).",
      },
    },
    required: ["categoryIds", "regionId", "confidence"],
  };
}

// The stable, cacheable prefix: instructions + the full taxonomy + region list.
// Identical on every request, so it can sit behind a single cache_control
// breakpoint and (where it clears the model's min-prefix size) bill as a cache
// read after the first call.
export function buildSystemPrompt(): string {
  const cats = CATEGORIES.map(
    (c) => `- ${c.id} (${c.name}): e.g. ${[...c.keywords, ...(c.wordKeywords ?? [])].slice(0, 6).join(", ")}`,
  ).join("\n");
  const regions = REGIONS.map((r) => `- ${r.id}: ${r.name}`).join("\n");
  return [
    "You categorize a Hungarian B2B business into a fixed procurement taxonomy.",
    "You are given the business name and short text from its own website / directory listing.",
    "",
    "Choose ALL category ids that clearly apply (return an empty list if none do —",
    "do not guess to fill the list). Most businesses fit zero or one category.",
    "Also return the region id of the business's seat if the text makes it clear,",
    "otherwise null. Finally return a confidence between 0 and 1 for the categories.",
    "Only ever use ids from the lists below.",
    "",
    "Categories:",
    cats,
    "",
    "Regions:",
    regions,
  ].join("\n");
}

// The varying per-lead suffix. Kept compact and bounded.
export function buildLeadText(input: AiLeadInput): string {
  const parts = [
    `Name: ${input.legalName}`,
    input.brandName ? `Brand: ${input.brandName}` : "",
    input.address ? `Address: ${input.address}` : "",
    input.classificationText ? `Listing: ${input.classificationText}` : "",
    input.websiteText ? `Website: ${input.websiteText}` : "",
  ].filter(Boolean);
  return parts.join("\n").slice(0, MAX_TEXT_CHARS);
}

// Assemble the full (non-streaming) Messages request for one lead. The taxonomy
// prefix carries the cache_control breakpoint; the per-lead text is the varying
// user turn. `model`/`maxTokens` come from config so this stays I/O-free.
export function buildRequestParams(opts: {
  model: string;
  maxTokens: number;
  input: AiLeadInput;
}): Anthropic.Messages.MessageCreateParamsNonStreaming {
  return {
    model: opts.model,
    max_tokens: opts.maxTokens,
    system: [
      {
        type: "text",
        text: buildSystemPrompt(),
        cache_control: { type: "ephemeral" },
      },
    ],
    output_config: {
      format: { type: "json_schema", schema: categorizationSchema() },
    },
    messages: [{ role: "user", content: buildLeadText(opts.input) }],
  };
}

// Defensive parse of a model response into an AiDecision. Even with structured
// outputs we never trust the wire: unknown ids are dropped, regionId is coerced
// to a known id or null, confidence is clamped to [0,1]. Returns null when the
// payload isn't usable at all.
export function parseDecision(raw: unknown): AiDecision | null {
  let obj: unknown = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj !== "object") return null;
  const r = obj as Record<string, unknown>;

  const categoryIds = Array.isArray(r.categoryIds)
    ? (r.categoryIds.filter((x): x is string => typeof x === "string" && CATEGORY_IDS.includes(x)))
    : [];
  // De-dupe while preserving order.
  const dedupedCats = [...new Set(categoryIds)];

  const regionId =
    typeof r.regionId === "string" && REGION_IDS.includes(r.regionId) ? r.regionId : null;

  let confidence = typeof r.confidence === "number" && Number.isFinite(r.confidence) ? r.confidence : 0;
  if (confidence < 0) confidence = 0;
  if (confidence > 1) confidence = 1;

  return { categoryIds: dedupedCats, regionId, confidence };
}

// Pull the model's JSON text out of a returned Message's content blocks.
export function decisionTextFromMessage(message: Anthropic.Messages.Message): string {
  return message.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}
