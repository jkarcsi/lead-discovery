// Side-effecting client for AI categorization. Offline it reads a fixture keyed
// by lead id (so the pipeline + tests run with no API key); live it submits a
// Message Batch to Claude (50% cheaper, async) with structured outputs, polls
// until it finishes, and returns one parsed result per lead.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { config } from "../config.js";
import {
  aiOutputSchema,
  buildSystemPrompt,
  buildUserPrompt,
  parseAiResult,
  type AiCategorization,
} from "../lib/aiCategorize.js";

const here = dirname(fileURLToPath(import.meta.url));

// `key` is a stable fixture lookup (the lead's legal name), so offline tests
// don't depend on the random lead id. Live mode ignores it.
export type AiInput = { id: string; text: string; key: string };
export type PollInfo = { status: string; done: number; total: number; elapsedMs: number };
export type ClassifyOptions = { live: boolean; onPoll?: (p: PollInfo) => void };

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// Offline: a JSON map of lead id → { categories, confidence }. Missing ids are
// treated as a low-confidence "no category" so the pipeline still marks them
// checked (it won't re-spend on them next run).
function classifyFixture(inputs: AiInput[]): Map<string, AiCategorization> {
  const path = join(here, "fixtures", "ai-categorize.json");
  const fx: Record<string, unknown> = existsSync(path)
    ? (JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>)
    : {};
  const out = new Map<string, AiCategorization>();
  for (const input of inputs) {
    out.set(input.id, parseAiResult(fx[input.key]));
  }
  return out;
}

// Pull the JSON object out of a batch result message (structured outputs return
// it as the text of the first content block).
function resultJson(message: { content?: Array<{ type: string; text?: string }> }): unknown {
  const text = message.content?.find((b) => b.type === "text")?.text ?? "";
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

async function classifyLive(
  inputs: AiInput[],
  onPoll?: (p: PollInfo) => void,
): Promise<Map<string, AiCategorization>> {
  if (!config.anthropicApiKey) {
    throw new Error(
      "AI categorization live mode needs an API key — set ANTHROPIC_API_KEY in .env, " +
        "or run without --live to use the fixture",
    );
  }
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: config.anthropicApiKey });

  const system = buildSystemPrompt();
  const schema = aiOutputSchema();
  const batch = await client.messages.batches.create({
    requests: inputs.map((input) => ({
      custom_id: input.id,
      params: {
        model: config.aiModel,
        max_tokens: 256,
        // Stable taxonomy/instructions prefix, marked cacheable.
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: buildUserPrompt(input.text) }],
        // Structured outputs: the response is constrained to the taxonomy enum.
        output_config: { format: { type: "json_schema", name: "categorization", schema } },
      },
    })),
  });

  // Poll until the batch finishes (batches can take up to ~24h; usually minutes).
  const startedAt = Date.now();
  let status = batch.processing_status;
  while (status !== "ended") {
    if (Date.now() - startedAt > config.aiPollMaxMs) {
      throw new Error(`AI batch ${batch.id} did not finish within the poll window`);
    }
    await sleep(config.aiPollIntervalMs);
    const cur = await client.messages.batches.retrieve(batch.id);
    status = cur.processing_status;
    onPoll?.({
      status,
      done: cur.request_counts.succeeded + cur.request_counts.errored + cur.request_counts.expired,
      total: inputs.length,
      elapsedMs: Date.now() - startedAt,
    });
  }

  const out = new Map<string, AiCategorization>();
  for await (const r of await client.messages.batches.results(batch.id)) {
    if (r.result.type === "succeeded") {
      out.set(r.custom_id, parseAiResult(resultJson(r.result.message)));
    }
    // errored / expired: leave unset — the pipeline retries them on the next run.
  }
  return out;
}

export async function classifyLeads(
  inputs: AiInput[],
  opts: ClassifyOptions,
): Promise<Map<string, AiCategorization>> {
  if (inputs.length === 0) return new Map();
  return opts.live ? classifyLive(inputs, opts.onPoll) : classifyFixture(inputs);
}
