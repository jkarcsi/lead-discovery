// Operator CLI for the lead-discovery service: collect, verify, review, and
// inspect the lead database, plus optional utilities (suppress/purge/dsar/ropa).
//
//   npm run cli -- collect --source overpass --region budapest
//   npm run cli -- collect --source overpass --region budapest --live --limit 100
//   npm run cli -- list --region budapest --category cleaning --min-quality 40
//   npm run cli -- stats
//   npm run cli -- suppress info@example.hu --kind EMAIL --reason "opt-out"

import { writeFileSync } from "node:fs";
import { db } from "./db.js";
import { config } from "./config.js";
import { ingest } from "./pipeline/ingest.js";
import { purge } from "./pipeline/purge.js";
import { verify } from "./pipeline/verify.js";
import { navVerify } from "./pipeline/navVerify.js";
import { enrichContacts } from "./pipeline/enrich.js";
import { recategorize } from "./pipeline/recategorize.js";
import { aiCategorize } from "./pipeline/aiCategorize.js";
import { placesEnrich } from "./pipeline/placesEnrich.js";
import { refresh } from "./pipeline/refresh.js";
import { exportProcura } from "./pipeline/exportProcura.js";
import { buildCoverageReport } from "./lib/report.js";
import { dsarExport, dsarErase } from "./pipeline/dsar.js";
import { reviewQueue, setReview } from "./pipeline/review.js";
import { listConnectors, connectorSources } from "./connectors/index.js";
import { VIES_LICENSE } from "./connectors/vies.js";
import { addSuppression, type SuppressionKind } from "./lib/suppression.js";
import { buildRopa, renderRopaMarkdown } from "./lib/ropa.js";
import { CATEGORIES, REGIONS } from "./taxonomy.js";

type Flags = Record<string, string | boolean>;

function parse(argv: string[]): { cmd: string; positional: string[]; flags: Flags } {
  const [cmd, ...rest] = argv;
  const positional: string[] = [];
  const flags: Flags = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = rest[i + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(a);
    }
  }
  return { cmd: cmd ?? "help", positional, flags };
}

function str(flags: Flags, key: string): string | undefined {
  const v = flags[key];
  return typeof v === "string" ? v : undefined;
}

// --region accepts a single id, a comma-separated list, or "all" (every region
// in the taxonomy). Regions are fetched concurrently.
function resolveRegions(spec: string | undefined): string[] {
  if (!spec) throw new Error('--region is required (e.g. --region budapest, --region all)');
  if (spec === "all") return REGIONS.map((r) => r.id);
  return spec.split(",").map((s) => s.trim()).filter(Boolean);
}

async function cmdCollect(flags: Flags): Promise<void> {
  const source = str(flags, "source") ?? "overpass";
  const regionIds = resolveRegions(str(flags, "region"));
  const live = flags.live === true;
  const full = flags.full === true;
  const limit = str(flags, "limit") ? Number(str(flags, "limit")) : undefined;

  const label = regionIds.length === 1 ? regionIds[0] : `${regionIds.length} regions`;
  const mode = `${live ? "LIVE" : "fixture"}${full ? ", full re-scan" : ", resume"}`;
  console.log(`Collecting from "${source}" for ${label} (${mode})…`);
  const start = Date.now();
  const stats = await ingest({ source, regionIds, live, limit, full });
  const secs = ((Date.now() - start) / 1000).toFixed(1);
  console.log(
    `Done in ${secs}s: fetched ${stats.fetched}, created ${stats.created}, ` +
      `merged ${stats.merged}, skipped (suppressed) ${stats.skippedSuppressed}.`,
  );
  if (stats.failedRegions.length) {
    console.log(`  (${stats.failedRegions.length} region(s) failed: ${stats.failedRegions.join(", ")})`);
  }
}

async function cmdList(flags: Flags): Promise<void> {
  const regionId = str(flags, "region");
  const category = str(flags, "category");
  const minQuality = str(flags, "min-quality") ? Number(str(flags, "min-quality")) : 0;

  const leads = await db.lead.findMany({
    where: {
      ...(regionId ? { regionId } : {}),
      qualityScore: { gte: minQuality },
    },
    orderBy: { qualityScore: "desc" },
    take: Number(str(flags, "limit") ?? 50),
  });

  const filtered = category
    ? leads.filter((l) => (JSON.parse(l.categories) as string[]).includes(category))
    : leads;

  if (filtered.length === 0) {
    console.log("No matching leads.");
    return;
  }
  for (const l of filtered) {
    const cats = (JSON.parse(l.categories) as string[]).join(", ") || "—";
    console.log(
      `[${String(l.qualityScore).padStart(3)}] ${l.legalName} · ${l.regionId ?? "?"} · ` +
        `${cats} · ${l.email ?? l.phone ?? "no contact"}${l.isPersonalData ? " · ⚠ personal" : ""}`,
    );
  }
}

async function cmdStats(): Promise<void> {
  const total = await db.lead.count();
  const withEmail = await db.lead.count({ where: { email: { not: null } } });
  const personal = await db.lead.count({ where: { isPersonalData: true } });
  const suppressed = await db.suppression.count();
  const pending = await db.lead.count({ where: { reviewStatus: "PENDING" } });
  const approved = await db.lead.count({ where: { reviewStatus: "APPROVED" } });
  const rejected = await db.lead.count({ where: { reviewStatus: "REJECTED" } });
  console.log(`Leads: ${total} (with email: ${withEmail}, personal-data: ${personal})`);
  console.log(`Review: ${pending} pending, ${approved} approved, ${rejected} rejected`);
  const navChecked = await db.lead.count({ where: { navCheckedAt: { not: null } } });
  if (navChecked > 0) {
    const active = await db.lead.count({ where: { taxStatus: "ACTIVE" } });
    const debtFree = await db.lead.count({ where: { debtFree: true } });
    console.log(`NAV: ${navChecked} checked (${active} active, ${debtFree} debt-free)`);
  }
  console.log(`Suppression entries: ${suppressed}`);

  console.log("\nBy region:");
  for (const r of REGIONS) {
    const c = await db.lead.count({ where: { regionId: r.id } });
    if (c > 0) console.log(`  ${r.name}: ${c}`);
  }

  console.log("\nBy category:");
  const all = await db.lead.findMany({ select: { categories: true } });
  const counts = new Map<string, number>();
  for (const l of all) {
    for (const c of JSON.parse(l.categories) as string[]) counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  for (const cat of CATEGORIES) {
    const c = counts.get(cat.id) ?? 0;
    if (c > 0) console.log(`  ${cat.name}: ${c}`);
  }

  const cursors = await db.crawlState.findMany({ orderBy: [{ source: "asc" }, { regionId: "asc" }] });
  if (cursors.length) {
    console.log("\nCrawl cursors (resume points):");
    for (const c of cursors) {
      console.log(`  ${c.source}/${c.regionId}: page ${c.lastPage} (${c.totalSeen} seen)`);
    }
  }
}

async function cmdSuppress(positional: string[], flags: Flags): Promise<void> {
  const value = positional[0];
  if (!value) throw new Error("usage: suppress <email|domain> --kind EMAIL|DOMAIN --reason <text>");
  const kind = (str(flags, "kind") ?? (value.includes("@") ? "EMAIL" : "DOMAIN")) as SuppressionKind;
  const reason = str(flags, "reason") ?? "manual";
  await addSuppression(value, kind, reason);
  console.log(`Suppressed ${kind} "${value}" (${reason}).`);
}

async function cmdVerify(flags: Flags): Promise<void> {
  const live = flags.live === true;
  const limit = str(flags, "limit") ? Number(str(flags, "limit")) : undefined;
  const revalidate = flags.revalidate === true;
  console.log(`Verifying VAT numbers against VIES (${live ? "LIVE" : "fixture"})…`);
  const s = await verify({ live, limit, revalidate });
  console.log(
    `Done: scanned ${s.scanned}, valid ${s.valid}, invalid ${s.invalid}, ` +
      `enriched ${s.enriched}, skipped ${s.skipped}.`,
  );
}

async function cmdNav(flags: Flags): Promise<void> {
  const live = flags.live === true;
  const limit = str(flags, "limit") ? Number(str(flags, "limit")) : undefined;
  const revalidate = flags.revalidate === true;
  console.log(`Checking tax numbers against NAV (${live ? "LIVE" : "fixture"})…`);
  const s = await navVerify({ live, limit, revalidate });
  console.log(
    `Done: scanned ${s.scanned}, checked ${s.checked} (active ${s.active}, ` +
      `suspended ${s.suspended}, cancelled ${s.cancelled}, debt-free ${s.debtFree}), ` +
      `skipped ${s.skipped}.`,
  );
}

async function cmdEnrich(flags: Flags): Promise<void> {
  const live = flags.live === true;
  const limit = str(flags, "limit") ? Number(str(flags, "limit")) : undefined;
  const revalidate = flags.revalidate === true;
  console.log(`Enriching contacts from websites (${live ? "LIVE" : "fixture"})…`);
  const s = await enrichContacts({ live, limit, revalidate, onProgress: progressLogger() });
  console.log(
    `Done: scanned ${s.scanned}, enriched ${s.enriched} ` +
      `(+${s.emailsAdded} email, +${s.phonesAdded} phone), skipped ${s.skipped}.`,
  );
}

// A throttled progress printer for long enrichment runs: logs ~20 lines total
// (and always the last one), with a running tally, elapsed time and a rough ETA.
function progressLogger(): (p: {
  scanned: number;
  enriched: number;
  emailsAdded: number;
  phonesAdded: number;
  skipped: number;
  total: number;
  elapsedMs: number;
}) => void {
  let step = 0;
  return (p) => {
    step = step || Math.max(1, Math.floor(p.total / 20));
    if (p.scanned % step !== 0 && p.scanned !== p.total) return;
    const secs = p.elapsedMs / 1000;
    const rate = secs > 0 ? p.scanned / secs : 0;
    const eta = rate > 0 ? Math.round((p.total - p.scanned) / rate) : 0;
    const width = String(p.total).length;
    console.log(
      `  [${String(p.scanned).padStart(width)}/${p.total}] ` +
        `+${p.emailsAdded} email, +${p.phonesAdded} phone, ${p.skipped} no-page · ` +
        `${secs.toFixed(0)}s elapsed, ~${eta}s left`,
    );
  };
}

async function cmdPlaces(flags: Flags): Promise<void> {
  const live = flags.live === true;
  const limit = str(flags, "limit") ? Number(str(flags, "limit")) : undefined;
  const revalidate = flags.revalidate === true;
  console.log(`Enriching from Google Places (${live ? "LIVE" : "fixture"})…`);
  const s = await placesEnrich({ live, limit, revalidate });
  console.log(
    `Done: scanned ${s.scanned}, enriched ${s.enriched} ` +
      `(+${s.phonesAdded} phone, +${s.websitesAdded} website, +${s.addressesAdded} address), ` +
      `skipped ${s.skipped}.`,
  );
}

async function cmdRecategorize(flags: Flags): Promise<void> {
  const dryRun = flags["dry-run"] === true;
  const limit = str(flags, "limit") ? Number(str(flags, "limit")) : undefined;
  console.log(`Re-categorizing leads from stored classification text${dryRun ? " (dry-run)" : ""}…`);
  const s = await recategorize({ dryRun, limit });
  console.log(
    `${dryRun ? "[dry-run] " : ""}Scanned ${s.scanned}, changed ${s.changed} ` +
      `(cleared ${s.cleared}), used name-fallback ${s.fallback}.`,
  );
}

async function cmdAiCategorize(flags: Flags): Promise<void> {
  const live = flags.live === true;
  const dryRun = flags["dry-run"] === true;
  const revalidate = flags.revalidate === true;
  const limit = str(flags, "limit") ? Number(str(flags, "limit")) : undefined;
  console.log(
    `AI-categorizing undetermined leads (${live ? "LIVE" : "fixture"} site text${dryRun ? ", dry-run" : ""})…`,
  );
  const s = await aiCategorize({ live, dryRun, revalidate, limit, log: (line) => console.log(line) });
  if (s.skippedNoKey) {
    console.log(
      `Skipped: AI is disabled (set ANTHROPIC_API_KEY to enable). ${s.scanned} undetermined lead(s) left to the rules / manual review.`,
    );
    return;
  }
  console.log(
    `${dryRun ? "[dry-run] " : ""}Scanned ${s.scanned}, submitted ${s.submitted}, ` +
      `categorized ${s.categorized}, held for review ${s.lowConfidence}, no result ${s.noResult}.`,
  );
}

async function cmdPurge(flags: Flags): Promise<void> {
  const dryRun = flags["dry-run"] === true;
  const stats = await purge({ dryRun });
  console.log(
    `${dryRun ? "[dry-run] " : ""}Purge: scanned ${stats.scanned}, ` +
      `now-suppressed ${stats.suppressed}, personal-data expired ${stats.personalDataExpired}` +
      `${dryRun ? " (nothing deleted)" : " deleted"}.`,
  );
}

async function cmdDsar(positional: string[]): Promise<void> {
  const action = positional[0];
  const email = positional[1];
  if (!email) throw new Error("usage: dsar <export|erase> <email>");
  if (action === "export") {
    const report = await dsarExport(email);
    console.log(JSON.stringify(report, null, 2));
  } else if (action === "erase") {
    const res = await dsarErase(email);
    console.log(
      `DSAR erase for "${res.subject}": erased ${res.erased} lead(s) and ` +
        `suppressed the address permanently.`,
    );
  } else {
    throw new Error(`Unknown dsar action "${action ?? ""}". Use "export" or "erase".`);
  }
}

async function cmdReview(positional: string[], flags: Flags): Promise<void> {
  const action = positional[0] ?? "queue";
  if (action === "queue") {
    const items = await reviewQueue({
      regionId: str(flags, "region"),
      category: str(flags, "category"),
      limit: str(flags, "limit") ? Number(str(flags, "limit")) : 50,
    });
    if (items.length === 0) {
      console.log("Review queue is empty (no PENDING leads match).");
      return;
    }
    console.log(`${items.length} lead(s) pending review:\n`);
    for (const it of items) {
      const cats = it.categories.join(", ") || "—";
      const flag = it.reasons.length ? `  ⚠ ${it.reasons.join("; ")}` : "  ✓ ready";
      console.log(
        `[${String(it.qualityScore).padStart(3)}] ${it.id}  ${it.legalName} · ` +
          `${it.regionId ?? "?"} · ${cats} · ${it.contact ?? "no contact"}\n${flag}`,
      );
    }
    return;
  }
  if (action === "approve" || action === "reject") {
    const leadId = positional[1];
    if (!leadId) throw new Error(`usage: review ${action} <leadId> [--note <text>]`);
    const res = await setReview(leadId, action, str(flags, "note"));
    console.log(`${res.status}: ${res.legalName} (${res.id}).`);
    return;
  }
  throw new Error(`Unknown review action "${action}". Use queue | approve | reject.`);
}

async function cmdRefresh(flags: Flags): Promise<void> {
  const regionIds = resolveRegions(str(flags, "region") ?? "all");
  const live = flags.live === true;
  console.log(`Refresh: collecting all sources for ${regionIds.length} region(s) (${live ? "LIVE" : "fixture"})…`);
  const s = await refresh({
    regionIds,
    live,
    log: (line) => console.log(line),
    onProgress: progressLogger(),
  });
  console.log(
    `Enrichment: VIES ${s.verified}, NAV ${s.navChecked}, contacts ${s.contactsEnriched}, ` +
      `places ${s.placesEnriched}.`,
  );
}

async function cmdExport(flags: Flags): Promise<void> {
  const out = str(flags, "out") ?? "procura-export.ndjson";
  const minQuality = str(flags, "min-quality") ? Number(str(flags, "min-quality")) : 0;
  const approvedOnly = flags.approved === true;
  const includePersonal = flags["include-personal"] === true;
  const s = await exportProcura({ out, minQuality, approvedOnly, includePersonal });
  console.log(`Exported ${s.exported} lead(s) to ${s.out}.`);
}

async function cmdReport(): Promise<void> {
  const rows = await db.lead.findMany({
    select: {
      source: true, categories: true, qualityScore: true, email: true, isPersonalData: true,
      lastVerifiedAt: true, navCheckedAt: true, contactCheckedAt: true, placesCheckedAt: true,
      reviewStatus: true,
    },
  });
  const r = buildCoverageReport(
    rows.map((l) => ({
      source: l.source,
      categories: JSON.parse(l.categories) as string[],
      qualityScore: l.qualityScore,
      hasEmail: l.email !== null,
      isPersonalData: l.isPersonalData,
      viesVerified: l.lastVerifiedAt !== null,
      navChecked: l.navCheckedAt !== null,
      contactChecked: l.contactCheckedAt !== null,
      placesChecked: l.placesCheckedAt !== null,
      reviewStatus: l.reviewStatus,
    })),
  );
  console.log(`Leads: ${r.total} (with email: ${r.withEmail}, personal-data: ${r.personalData})`);
  console.log(`Quality: ${r.quality.high} high (70+), ${r.quality.medium} medium, ${r.quality.low} low`);
  console.log(`Review: ${r.review.pending} pending, ${r.review.approved} approved, ${r.review.rejected} rejected`);
  console.log(
    `Enrichment: VIES ${r.enrichment.viesVerified}, NAV ${r.enrichment.navChecked}, ` +
      `contacts ${r.enrichment.contactChecked}, places ${r.enrichment.placesChecked}`,
  );
  console.log("By source:");
  for (const [src, n] of r.bySource) console.log(`  ${src.padEnd(14)} ${n}`);
}

function cmdRopa(flags: Flags): void {
  const ropa = buildRopa({
    generatedAt: new Date(),
    controller: {
      name: config.controllerName,
      contact: config.controllerContact,
      dpo: config.controllerDpo,
    },
    categories: CATEGORIES.map((c) => ({ id: c.id, name: c.name })),
    regionCount: REGIONS.length,
    sources: [...connectorSources(), { id: "vies", license: VIES_LICENSE }],
    personalDataRetentionDays: config.personalDataRetentionDays,
    outreachEnabled: config.outreachEnabled,
  });
  const md = renderRopaMarkdown(ropa);
  if (flags.write === true) {
    writeFileSync("docs/ROPA.md", md + "\n");
    console.log("Wrote docs/ROPA.md");
  } else {
    console.log(md);
  }
}

function help(): void {
  console.log(`lead-discovery CLI

Commands:
  collect --source <id> --region <id|a,b|all> [--live] [--full] [--limit N]
  list    [--region <id>] [--category <id>] [--min-quality N] [--limit N]
  stats
  suppress <email|domain> [--kind EMAIL|DOMAIN] [--reason <text>]
  review  queue [--region <id>] [--category <id>] [--limit N]
  review  <approve|reject> <leadId> [--note <text>]
  verify  [--live] [--limit N] [--revalidate]  VAT-check leads against EU VIES
  nav     [--live] [--limit N] [--revalidate]  tax-status check against NAV
  enrich  [--live] [--limit N] [--revalidate]  fill missing email/phone from sites
  places  [--live] [--limit N] [--revalidate]  fill phone/website/address via Places
  refresh [--region <id|a,b|all>] [--live]     collect all sources + enrich
  report                                       coverage / enrichment dashboard
  recategorize [--dry-run] [--limit N]         recompute categories on stored leads
  ai-categorize [--live] [--dry-run] [--limit N] [--revalidate]
                                               classify rule-undetermined leads via
                                               Claude Haiku (batch); needs ANTHROPIC_API_KEY
  export  [--out f.ndjson] [--min-quality N] [--approved] [--include-personal]
  dsar    <export|erase> <email>   data-subject access / erasure (GDPR)
  ropa    [--write]   print (or write docs/ROPA.md) the Art. 30 record
  purge   [--dry-run]   erase now-suppressed + expired personal-data leads

Connectors: ${listConnectors().join(", ")}
Regions:    ${REGIONS.map((r) => r.id).join(", ")}
Categories: ${CATEGORIES.map((c) => c.id).join(", ")}`);
}

async function main(): Promise<void> {
  const { cmd, positional, flags } = parse(process.argv.slice(2));
  switch (cmd) {
    case "collect":
      await cmdCollect(flags);
      break;
    case "list":
      await cmdList(flags);
      break;
    case "stats":
      await cmdStats();
      break;
    case "suppress":
      await cmdSuppress(positional, flags);
      break;
    case "verify":
      await cmdVerify(flags);
      break;
    case "nav":
      await cmdNav(flags);
      break;
    case "enrich":
      await cmdEnrich(flags);
      break;
    case "places":
      await cmdPlaces(flags);
      break;
    case "refresh":
      await cmdRefresh(flags);
      break;
    case "report":
      await cmdReport();
      break;
    case "recategorize":
      await cmdRecategorize(flags);
      break;
    case "ai-categorize":
      await cmdAiCategorize(flags);
      break;
    case "export":
      await cmdExport(flags);
      break;
    case "dsar":
      await cmdDsar(positional);
      break;
    case "review":
      await cmdReview(positional, flags);
      break;
    case "ropa":
      cmdRopa(flags);
      break;
    case "purge":
      await cmdPurge(flags);
      break;
    default:
      help();
  }
  await db.$disconnect();
}

main().catch(async (err) => {
  console.error("Error:", err instanceof Error ? err.message : err);
  await db.$disconnect();
  process.exit(1);
});
