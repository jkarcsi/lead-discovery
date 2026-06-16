// AI categorization of the rule-residual (IMPLEMENTATION_PLAN.md §9.1).
//
// Rules (src/lib/categorize.ts) place most leads for free at collection time.
// This step takes only the leads the rules COULDN'T place — `categories == "[]"`
// — and asks Claude Haiku 4.5 to classify them from their name + listing + a
// little scraped website text, the cheapest way possible:
//   • one Message Batch (50% off) for the whole residual,
//   • a prompt-cached taxonomy prefix + structured outputs (taxonomy enum),
//   • the decision stored on the Lead so each business is categorized once.
//
// Hard rule 4: the whole loop must work WITHOUT a key. With no key (or no SDK
// installed) this is a clean no-op — the rules already ran. Low-confidence
// decisions are recorded but NOT written to `categories`, so they stay in the
// manual review queue and never reach auto-outreach.

import { db } from "../db.js";
import { config, aiEnabled } from "../config.js";
import { mapWithConcurrency } from "../lib/concurrency.js";
import { recordAudit } from "../lib/audit.js";
import { fetchSiteText } from "../connectors/websiteText.js";
import {
  AI_PROMPT_VERSION,
  buildRequestParams,
  parseDecision,
  decisionTextFromMessage,
  type AiLeadInput,
  type AiDecision,
} from "../lib/aiCategorize.js";

export type AiCategorizeOptions = {
  live?: boolean; // scrape live sites for text (else use fixtures)
  limit?: number; // cap candidates this run (defaults to config.aiBatchMaxLeads)
  dryRun?: boolean; // build the batch but don't call the API or write
  revalidate?: boolean; // re-decide leads already categorized at an older prompt version
  now?: Date;
  log?: (line: string) => void;
};

export type AiCategorizeStats = {
  scanned: number; // candidates considered
  submitted: number; // leads sent to the batch
  categorized: number; // confident decisions that set categories
  lowConfidence: number; // decisions held for manual review (no categories set)
  noResult: number; // empty / unparseable / errored results
  skippedNoKey: boolean; // AI disabled (no key/SDK) — nothing was sent
};

// One pending request: the lead id (used as the batch custom_id) + its input.
type Candidate = { id: string; input: AiLeadInput };

export async function aiCategorize(opts: AiCategorizeOptions = {}): Promise<AiCategorizeStats> {
  const now = opts.now ?? new Date();
  const live = opts.live ?? false;
  const log = opts.log ?? (() => {});
  const max = opts.limit ?? config.aiBatchMaxLeads;

  const stats: AiCategorizeStats = {
    scanned: 0,
    submitted: 0,
    categorized: 0,
    lowConfidence: 0,
    noResult: 0,
    skippedNoKey: false,
  };

  // Candidates: rules found nothing. Without --revalidate, skip leads already
  // decided at the current prompt version (computed once, never re-paid).
  const leads = await db.lead.findMany({
    where: {
      categories: "[]",
      ...(opts.revalidate ? {} : { OR: [{ aiCategorizedAt: null }, { aiPromptVersion: { not: AI_PROMPT_VERSION } }] }),
    },
    select: {
      id: true,
      legalName: true,
      brandName: true,
      address: true,
      classificationText: true,
      domain: true,
      regionId: true,
    },
    take: max,
  });
  stats.scanned = leads.length;
  if (leads.length === 0) return stats;

  // Gather scraped website text concurrently (fetch is the slow part). A lead
  // with no domain just contributes its name + listing text.
  const candidates: Candidate[] = [];
  const regionById = new Map<string, string | null>();
  await mapWithConcurrency(leads, Math.max(1, config.fetchConcurrency), async (lead) => {
    const websiteText = lead.domain ? await fetchSiteText(lead.domain, { live }) : null;
    regionById.set(lead.id, lead.regionId);
    candidates.push({
      id: lead.id,
      input: {
        legalName: lead.legalName,
        brandName: lead.brandName,
        address: lead.address,
        classificationText: lead.classificationText,
        websiteText,
      },
    });
  });

  const requests = candidates.map((c) => ({
    custom_id: c.id,
    params: buildRequestParams({ model: config.aiModel, maxTokens: config.aiMaxTokens, input: c.input }),
  }));

  // Preview the batch without spending or needing a key — useful to size a run.
  if (opts.dryRun) {
    stats.submitted = requests.length;
    log(`[dry-run] would submit ${requests.length} lead(s) to the ${config.aiModel} batch.`);
    return stats;
  }

  // No key (or SDK missing) → no-op. The rules already ran; nothing else changes.
  if (!aiEnabled()) {
    stats.skippedNoKey = true;
    log(`AI categorization disabled (no ANTHROPIC_API_KEY): ${candidates.length} undetermined lead(s) left to the rules / manual review.`);
    return stats;
  }

  // Load the SDK lazily so the rest of the CLI runs even if it isn't installed.
  const client = await loadClient();
  if (!client) {
    stats.skippedNoKey = true;
    log("AI categorization unavailable: @anthropic-ai/sdk is not installed (`npm i @anthropic-ai/sdk`).");
    return stats;
  }

  log(`Submitting ${requests.length} lead(s) to a ${config.aiModel} batch (50% off, prompt-cached)…`);
  const batch = await client.messages.batches.create({ requests });
  stats.submitted = requests.length;

  // Poll until the batch ends (most finish < 1h; ceiling at config.aiBatchTimeoutMs).
  const startedAt = Date.now();
  let status = batch.processing_status;
  while (status !== "ended") {
    if (Date.now() - startedAt > config.aiBatchTimeoutMs) {
      throw new Error(`batch ${batch.id} did not finish within ${Math.round(config.aiBatchTimeoutMs / 1000)}s`);
    }
    await sleep(config.aiBatchPollIntervalMs);
    const cur = await client.messages.batches.retrieve(batch.id);
    status = cur.processing_status;
    log(`  batch ${batch.id}: ${status} (${cur.request_counts.processing} processing, ${cur.request_counts.succeeded} done)`);
  }

  // Apply results. DB writes are serialized (SQLite is single-writer).
  for await (const item of await client.messages.batches.results(batch.id)) {
    const leadId = item.custom_id;
    if (item.result.type !== "succeeded") {
      stats.noResult++;
      continue;
    }
    const decision = parseDecision(decisionTextFromMessage(item.result.message));
    if (!decision) {
      stats.noResult++;
      continue;
    }
    await applyDecision(leadId, decision, regionById.get(leadId) ?? null, now, stats);
  }

  log(
    `Done: scanned ${stats.scanned}, submitted ${stats.submitted}, categorized ${stats.categorized}, ` +
      `held for review ${stats.lowConfidence}, no result ${stats.noResult}.`,
  );
  return stats;
}

// Store one decision (compute-once provenance always recorded). Categories are
// written only for confident, non-empty results; everything else is recorded but
// left to manual review so it never reaches auto-outreach.
async function applyDecision(
  leadId: string,
  decision: AiDecision,
  currentRegionId: string | null,
  now: Date,
  stats: AiCategorizeStats,
): Promise<void> {
  const confident = decision.confidence >= config.aiConfidenceThreshold && decision.categoryIds.length > 0;

  const data: Record<string, unknown> = {
    aiCategorizedAt: now,
    aiConfidence: decision.confidence,
    aiModel: config.aiModel,
    aiPromptVersion: AI_PROMPT_VERSION,
  };
  // Backfill region only when the lead lacked one — never overwrite a known seat.
  if (!currentRegionId && decision.regionId) data.regionId = decision.regionId;
  if (confident) {
    data.categories = JSON.stringify(decision.categoryIds);
    stats.categorized++;
  } else {
    stats.lowConfidence++;
  }

  await db.lead.update({ where: { id: leadId }, data });
  await recordAudit(leadId, "AI_CATEGORIZED", {
    model: config.aiModel,
    promptVersion: AI_PROMPT_VERSION,
    confidence: decision.confidence,
    categoryIds: decision.categoryIds,
    regionId: decision.regionId,
    applied: confident,
  });
}

// Lazy SDK load: returns a client, or null if the package isn't installed.
async function loadClient(): Promise<import("@anthropic-ai/sdk").default | null> {
  try {
    const mod = await import("@anthropic-ai/sdk");
    return new mod.default({ apiKey: config.anthropicApiKey });
  } catch {
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
