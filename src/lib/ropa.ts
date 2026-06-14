// Art. 30(1) Record of Processing Activities (ROPA), built from the codebase's
// own sources of truth (taxonomy, config, connector registry) so it can't drift
// from what the system actually does. Pure (no I/O): `pipeline`/`cli` gather the
// inputs and write the rendered Markdown to docs/ROPA.md.
//
// This is a living operational record, not legal advice — the lawful basis and
// controller details are validated with counsel before any outreach ships.

export type RopaSource = { id: string; license: string };

export type RopaInputs = {
  generatedAt: Date;
  controller: { name: string; contact: string; dpo: string };
  categories: { id: string; name: string }[];
  regionCount: number;
  sources: RopaSource[];
  personalDataRetentionDays: number;
  outreachEnabled: boolean;
};

export type Ropa = {
  generatedAt: string;
  controller: { name: string; contact: string; dpo: string };
  purposes: string[];
  lawfulBasis: string;
  dataSubjectCategories: string[];
  personalDataCategories: string[];
  specialCategories: string;
  businessCoverage: { categories: string[]; regionCount: number };
  sources: RopaSource[];
  recipients: string[];
  internationalTransfers: string;
  retention: string[];
  securityMeasures: string[];
  dataSubjectRights: string[];
};

export function buildRopa(input: RopaInputs): Ropa {
  return {
    generatedAt: input.generatedAt.toISOString(),
    controller: input.controller,
    purposes: [
      "Build a categorized database of Hungarian businesses so a buyer's RFQ can also reach relevant not-yet-registered suppliers (the Procura growth loop).",
      "Verify and de-duplicate business records to keep matching accurate.",
    ],
    lawfulBasis:
      "GDPR Art. 6(1)(f) legitimate interest (collecting public business contact data). Lawful-basis validation is handled by the operator separately — see docs/SCOPE.md.",
    dataSubjectCategories: [
      "Legal entities (Kft., Zrt., Bt., …) — company data and general business contacts are largely NOT personal data.",
      "Sole traders (egyéni vállalkozó) and named-person contacts — personal data; flagged isPersonalData and treated conservatively.",
    ],
    personalDataCategories: [
      "Business identity: legal/brand name, VAT number, registration number",
      "Business contact: general email, phone, website/domain, postal address",
      "Classification & provenance: category ids, region, source, source URL, licence, collection/verification timestamps",
    ],
    specialCategories:
      "None. No special-category (Art. 9) data, and nothing behind authentication or paywalls, is collected.",
    businessCoverage: {
      categories: input.categories.map((c) => `${c.name} (${c.id})`),
      regionCount: input.regionCount,
    },
    sources: input.sources,
    recipients: [
      `None currently. No outreach or third-party sharing is enabled (OUTREACH_ENABLED=${input.outreachEnabled}).`,
      "Planned (gated on counsel sign-off): export to Procura for the cold-invite loop — not active.",
    ],
    internationalTransfers: "None. Data is stored within the EU; no transfers to third countries.",
    retention: [
      `Never-engaged personal-data leads: erased ${input.personalDataRetentionDays} days after collection (cli purge; configurable via PERSONAL_DATA_RETENTION_DAYS).`,
      "Suppression list (opt-outs, bounces, DSAR erasures): retained permanently to honor do-not-contact.",
      "Audit trail: retained for accountability (Art. 5(2)); erasure leaves a detached, personal-data-free record.",
    ],
    securityMeasures: [
      "Global suppression checked at ingest (and at send, once gated outreach exists).",
      "Provenance on every record (source, source URL, licence, collectedAt).",
      "Append-only audit trail of every collect / merge / verify / suppress / erase.",
      "Polite collection only: identified User-Agent + contact URL, per-domain rate limits, robots.txt honored; no auth/paywall bypass.",
    ],
    dataSubjectRights: [
      "Access / portability (Art. 15/20): `cli dsar export <email>` returns a full copy of what is held plus the audit trail.",
      "Erasure / objection (Art. 17/21): `cli dsar erase <email>` erases the subject's leads and permanently suppresses the address.",
      "Transparency (Art. 14): public privacy notice + source disclosure in the first message (pending outreach phase).",
    ],
  };
}

function section(title: string, items: string[]): string {
  return `## ${title}\n\n${items.map((i) => `- ${i}`).join("\n")}\n`;
}

export function renderRopaMarkdown(ropa: Ropa): string {
  return [
    "# Record of Processing Activities (GDPR Art. 30)",
    "",
    "> Generated from the codebase (taxonomy, config, connectors) by `npm run cli -- ropa`.",
    "> Living operational record, not legal advice — see docs/SCOPE.md.",
    "",
    `**Generated:** ${ropa.generatedAt}`,
    "",
    section("Controller", [
      `Name: ${ropa.controller.name}`,
      `Contact: ${ropa.controller.contact}`,
      `DPO: ${ropa.controller.dpo}`,
    ]),
    section("Purposes of processing", ropa.purposes),
    `## Lawful basis\n\n${ropa.lawfulBasis}\n`,
    section("Categories of data subjects", ropa.dataSubjectCategories),
    section("Categories of personal data", ropa.personalDataCategories),
    `## Special categories\n\n${ropa.specialCategories}\n`,
    section(
      "Business coverage",
      [
        `Regions: ${ropa.businessCoverage.regionCount} (all 19 counties + Budapest)`,
        `Categories: ${ropa.businessCoverage.categories.join("; ")}`,
      ],
    ),
    section(
      "Sources",
      ropa.sources.map((s) => `${s.id} — licence: ${s.license}`),
    ),
    section("Recipients", ropa.recipients),
    `## International transfers\n\n${ropa.internationalTransfers}\n`,
    section("Retention", ropa.retention),
    section("Technical & organizational measures", ropa.securityMeasures),
    section("Data-subject rights (how exercised)", ropa.dataSubjectRights),
  ].join("\n");
}
