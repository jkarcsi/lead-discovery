// Pure helpers for EU VIES VAT verification (no I/O). The live HTTP call lives
// in `connectors/vies.ts`; everything decision-shaped is here so it's testable.
//
// VIES (the European Commission's VAT Information Exchange System) confirms a
// VAT number is registered and, for many member states incl. Hungary, returns
// the registered name and address — authoritative public data we use to verify
// and lightly enrich a lead (set `lastVerifiedAt`, fill a missing address).

import { digitsOnly, isValidHuVat } from "./normalize.js";

export type ViesResult = {
  valid: boolean;
  name: string | null;
  address: string | null;
  requestDate: string | null;
};

// VIES keys Hungarian numbers by their 8-digit base. Returns it only when the
// checksum is valid — no point asking VIES about a malformed number.
export function huVatForVies(vat: string | null | undefined): string | null {
  if (!isValidHuVat(vat)) return null;
  return digitsOnly(vat).slice(0, 8);
}

// VIES uses "---" as a placeholder for fields it won't disclose.
function cleanField(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.replace(/\s+/g, " ").trim();
  return !s || s === "---" ? null : s;
}

export function parseViesResponse(json: unknown): ViesResult {
  const o = (json ?? {}) as Record<string, unknown>;
  return {
    valid: o.valid === true,
    name: cleanField(o.name),
    address: cleanField(o.address),
    requestDate: typeof o.requestDate === "string" ? o.requestDate : null,
  };
}

export type VerificationPatch = { address?: string };

// What to write back after a VIES check. Pure and I/O-free. Only fills gaps from
// authoritative data — never overwrites a value the lead already has, and never
// enriches from an invalid result. (`lastVerifiedAt` is stamped by the caller
// regardless, since the check did happen.)
export function verificationPatch(
  lead: { address: string | null },
  result: ViesResult,
): VerificationPatch {
  const patch: VerificationPatch = {};
  if (result.valid && !lead.address && result.address) patch.address = result.address;
  return patch;
}
