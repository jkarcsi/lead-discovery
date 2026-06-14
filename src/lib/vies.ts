// Pure helpers for EU VIES VAT-number verification (no I/O). VIES is the
// European Commission's official VAT-validation service — a Tier-1, terms-clean
// source (see docs/LEGAL.md). The side-effecting HTTP call lives in
// `pipeline/verify.ts`; everything here is request-shaping and response-parsing
// so it can be unit-tested offline.

import { digitsOnly } from "./normalize.js";

// Outcome of a VIES check, normalized into our own shape.
export type ViesResult = {
  valid: boolean;
  // VIES echoes the registered trader name/address when a record is public;
  // both can be absent (privacy settings) even for a valid number.
  name: string | null;
  address: string | null;
  requestDate: string | null;
};

// The 8-digit core of a Hungarian VAT number (strips an optional `HU` prefix
// and any `-x-yy` suffix). Returns null if it can't be reduced to 8 digits.
export function huVatCore(raw: string | null | undefined): string | null {
  const core = digitsOnly(raw).slice(0, 8);
  return core.length === 8 ? core : null;
}

// JSON body for the VIES REST endpoint.
export function viesRequestBody(countryCode: string, vatNumber: string): {
  countryCode: string;
  vatNumber: string;
} {
  return { countryCode: countryCode.toUpperCase(), vatNumber: digitsOnly(vatNumber) };
}

// Parse a VIES REST response into a ViesResult. Tolerant of missing/empty
// fields (VIES uses "---" and empty strings for withheld data).
export function parseViesResult(json: unknown): ViesResult {
  const o = (json ?? {}) as Record<string, unknown>;
  const clean = (v: unknown): string | null => {
    const s = typeof v === "string" ? v.trim() : "";
    return s && s !== "---" ? s : null;
  };
  return {
    valid: o.valid === true,
    name: clean(o.name),
    address: clean(o.address),
    requestDate: clean(o.requestDate),
  };
}
