// Tier-2 AI categorization. For leads the rule-based categorizer left empty but
// which have website text (from `enrich`), ask Claude Haiku to classify the text
// into the taxonomy. The decision is stored ON the lead (aiCheckedAt) so it is
// computed once. High-confidence suggestions are applied to `categories`;
// low-confidence ones are recorded for manual review and never auto-applied,
// so they can't drive cold outreach.

import { db } from "../db.js";
import { classifyLeads, type AiInput, type PollInfo } from "../connectors/aiClient.js";
import { qualityScore } from "../lib/quality.js";
import { leadInputFromRow } from "../lib/leadRow.js";
import { recordAudit } from "../lib/audit.js";

export type AiCategorizeOptions = {
  live?: boolean;
  limit?: number;
  revalidate?: boolean;
  now?: Date;
  onPoll?: (p: PollInfo) => void;
};

export type AiCategorizeStats = {
  scanned: number;
  categorized: number; // high-confidence, applied to `categories`
  lowConfidence: number; // suggestion recorded, left for review
  none: number; // model found no matching category
};

// Enough website text to be worth a model call; below this it's noise.
const MIN_TEXT_LEN = 40;

export async function aiCategorize(opts: AiCategorizeOptions = {}): Promise<AiCategorizeStats> {
  const now = opts.now ?? new Date();
  const live = opts.live ?? false;

  const leads = await db.lead.findMany({
    where: {
      categories: "[]", // rules found nothing
      classificationText: { not: null },
      ...(opts.revalidate ? {} : { aiCheckedAt: null }),
    },
    ...(opts.limit ? { take: opts.limit } : {}),
  });

  const inputs: AiInput[] = leads
    .filter((l) => (l.classificationText ?? "").trim().length >= MIN_TEXT_LEN)
    .map((l) => ({ id: l.id, text: l.classificationText as string, key: l.legalName }));

  const stats: AiCategorizeStats = { scanned: inputs.length, categorized: 0, lowConfidence: 0, none: 0 };
  if (inputs.length === 0) return stats;

  const results = await classifyLeads(inputs, { live, onPoll: opts.onPoll });
  const byId = new Map(leads.map((l) => [l.id, l]));

  for (const [id, result] of results) {
    const lead = byId.get(id);
    if (!lead) continue;

    const data: Record<string, unknown> = {
      aiCheckedAt: now,
      aiCategories: JSON.stringify(result.categories),
      aiConfidence: result.confidence,
    };

    if (result.categories.length === 0) {
      stats.none++;
    } else if (result.confidence === "high") {
      // Apply: the model is confident the business provides these services.
      stats.categorized++;
      data.categories = JSON.stringify(result.categories);
      data.qualityScore = qualityScore({ ...leadInputFromRow(lead), categories: result.categories });
    } else {
      // Low confidence: keep `categories` empty (stays in the review queue); the
      // suggestion lives in aiCategories for a human to confirm.
      stats.lowConfidence++;
    }

    await db.lead.update({ where: { id }, data });
    if (data.categories !== undefined || result.categories.length > 0) {
      await recordAudit(id, "AI_CATEGORIZED", {
        suggested: result.categories,
        confidence: result.confidence,
        applied: data.categories !== undefined,
      });
    }
  }

  return stats;
}
