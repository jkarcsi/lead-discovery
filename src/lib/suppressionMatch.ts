// Pure suppression matching (no I/O). The values that identify a lead against
// the do-not-contact set: its email, that email's domain, and its website
// domain — normalized the way Suppression stores them (lowercased, trimmed).

export function leadSuppressionKeys(lead: {
  email?: string | null;
  domain?: string | null;
}): string[] {
  const email = lead.email?.trim().toLowerCase() || null;
  const emailDomain = email ? email.split("@")[1] ?? null : null;
  const domain = lead.domain?.trim().toLowerCase() || null;
  return [email, emailDomain, domain].filter((v): v is string => v !== null);
}

export function isLeadSuppressed(
  lead: { email?: string | null; domain?: string | null },
  suppressed: Set<string>,
): boolean {
  return leadSuppressionKeys(lead).some((k) => suppressed.has(k));
}
