// Global do-not-contact list. Checked before every outreach send AND at ingest
// (so a suppressed business is never re-collected with contactable data). An
// opt-out or hard bounce adds to it permanently. See docs/LEGAL.md.

import { db } from "../db.js";
import { domainFromUrl } from "./normalize.js";

export type SuppressionKind = "EMAIL" | "DOMAIN";

function normValue(value: string, kind: SuppressionKind): string {
  return kind === "EMAIL"
    ? value.trim().toLowerCase()
    : (domainFromUrl(value) ?? value.trim().toLowerCase());
}

export async function addSuppression(
  value: string,
  kind: SuppressionKind,
  reason: string,
): Promise<void> {
  const v = normValue(value, kind);
  await db.suppression.upsert({
    where: { value: v },
    update: { reason },
    create: { value: v, kind, reason },
  });
}

// True if either the exact email or its domain is suppressed.
export async function isSuppressed(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  const e = email.trim().toLowerCase();
  const domain = e.split("@")[1] ?? null;
  const values = [e, ...(domain ? [domain] : [])];
  const hit = await db.suppression.findFirst({ where: { value: { in: values } } });
  return hit !== null;
}

export async function isDomainSuppressed(domain: string | null | undefined): Promise<boolean> {
  if (!domain) return false;
  const hit = await db.suppression.findFirst({
    where: { value: domain.trim().toLowerCase(), kind: "DOMAIN" },
  });
  return hit !== null;
}
