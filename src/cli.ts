// Operator CLI for the lead-discovery service. Phase-1 commands only collect,
// inspect, and manage suppression — there is no outreach command (gated phase).
//
//   npm run cli -- collect --source overpass --region budapest
//   npm run cli -- collect --source overpass --region budapest --live --limit 100
//   npm run cli -- list --region budapest --category cleaning --min-quality 40
//   npm run cli -- stats
//   npm run cli -- suppress info@example.hu --kind EMAIL --reason "opt-out"

import { db } from "./db.js";
import { ingest } from "./pipeline/ingest.js";
import { purge } from "./pipeline/purge.js";
import { listConnectors } from "./connectors/index.js";
import { addSuppression, type SuppressionKind } from "./lib/suppression.js";
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

async function cmdCollect(flags: Flags): Promise<void> {
  const source = str(flags, "source") ?? "overpass";
  const regionId = str(flags, "region");
  if (!regionId) throw new Error("--region is required (e.g. --region budapest)");
  const live = flags.live === true;
  const limit = str(flags, "limit") ? Number(str(flags, "limit")) : undefined;

  console.log(`Collecting from "${source}" for region "${regionId}" (${live ? "LIVE" : "fixture"})…`);
  const stats = await ingest({ source, regionId, live, limit });
  console.log(
    `Done: fetched ${stats.fetched}, created ${stats.created}, merged ${stats.merged}, ` +
      `skipped (suppressed) ${stats.skippedSuppressed}.`,
  );
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
  console.log(`Leads: ${total} (with email: ${withEmail}, personal-data: ${personal})`);
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
}

async function cmdSuppress(positional: string[], flags: Flags): Promise<void> {
  const value = positional[0];
  if (!value) throw new Error("usage: suppress <email|domain> --kind EMAIL|DOMAIN --reason <text>");
  const kind = (str(flags, "kind") ?? (value.includes("@") ? "EMAIL" : "DOMAIN")) as SuppressionKind;
  const reason = str(flags, "reason") ?? "manual";
  await addSuppression(value, kind, reason);
  console.log(`Suppressed ${kind} "${value}" (${reason}).`);
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

function help(): void {
  console.log(`lead-discovery CLI

Commands:
  collect --source <id> --region <id> [--live] [--limit N]
  list    [--region <id>] [--category <id>] [--min-quality N] [--limit N]
  stats
  suppress <email|domain> [--kind EMAIL|DOMAIN] [--reason <text>]
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
