// Pure parsing/normalization of NAV (Nemzeti Adó- és Vámhivatal) signals for a
// taxpayer (no I/O). NAV exposes the tax-number status (active / suspended /
// cancelled), debt-free status (köztartozásmentes adózói adatbázis), and
// headcount. The live lookup + offline fixture live in `connectors/nav.ts`.

export type TaxStatus = "ACTIVE" | "SUSPENDED" | "CANCELLED" | "UNKNOWN";

export type NavSignals = {
  taxStatus: TaxStatus;
  debtFree: boolean | null;
  employeeCount: number | null;
};

const TAX_STATUSES: TaxStatus[] = ["ACTIVE", "SUSPENDED", "CANCELLED", "UNKNOWN"];

function normalizeStatus(v: unknown): TaxStatus {
  const s = String(v ?? "").trim().toUpperCase();
  return (TAX_STATUSES as string[]).includes(s) ? (s as TaxStatus) : "UNKNOWN";
}

export function parseNavResponse(json: unknown): NavSignals {
  const o = (json ?? {}) as Record<string, unknown>;
  const count = Number(o.employeeCount);
  return {
    taxStatus: normalizeStatus(o.taxStatus),
    debtFree: typeof o.debtFree === "boolean" ? o.debtFree : null,
    employeeCount: Number.isFinite(count) && count >= 0 ? Math.trunc(count) : null,
  };
}

// Risk / caution flags an operator would want to see (empty = clean).
export function navRiskReasons(s: NavSignals): string[] {
  const reasons: string[] = [];
  if (s.taxStatus === "CANCELLED") reasons.push("tax number cancelled");
  else if (s.taxStatus === "SUSPENDED") reasons.push("tax number suspended");
  if (s.debtFree === false) reasons.push("has tax debt (not köztartozásmentes)");
  return reasons;
}
