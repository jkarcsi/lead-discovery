// Pure normalization helpers (no I/O). Used by the pipeline and tests.

export function normalizeEmail(raw: string | null | undefined): string | null {
  const e = (raw ?? "").trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) ? e : null;
}

// Hungarian phone numbers → E.164 (+36...). Returns null if it can't be made
// into a plausible HU number.
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = raw.replace(/[^\d+]/g, "");
  if (s.startsWith("+36")) {
    s = "+36" + s.slice(3).replace(/\D/g, "");
  } else if (s.startsWith("0036")) {
    s = "+36" + s.slice(4);
  } else if (s.startsWith("06")) {
    s = "+36" + s.slice(2);
  } else if (s.startsWith("36") && s.length >= 10) {
    s = "+" + s;
  } else {
    return null;
  }
  const digits = s.slice(3);
  // HU subscriber numbers are 8–9 digits after the country code.
  if (digits.length < 8 || digits.length > 9) return null;
  return s;
}

export function domainFromUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = raw.trim().toLowerCase();
  if (!s) return null;
  if (!/^https?:\/\//.test(s)) s = "http://" + s;
  try {
    const host = new URL(s).hostname.replace(/^www\./, "");
    return host.includes(".") ? host : null;
  } catch {
    return null;
  }
}

const LEGAL_FORMS = [
  "kft.", "kft", "zrt.", "zrt", "nyrt.", "nyrt", "bt.", "bt", "kkt.", "kkt",
  "e.v.", "ev", "egyéni vállalkozó", "egyeni vallalkozo", "kht.", "kht",
  "k?zhasznú", "szövetkezet", "szovetkezet",
];

// Lowercased, accent-light, legal-form-stripped name for fuzzy dedupe.
export function normalizeCompanyName(raw: string | null | undefined): string {
  let s = (raw ?? "").toLowerCase().trim();
  for (const form of LEGAL_FORMS) {
    s = s.replace(new RegExp("\\b" + form.replace(/[.?]/g, "\\$&") + "\\b", "g"), " ");
  }
  return s.replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim();
}

// Digits only — for VAT / registration numbers.
export function digitsOnly(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\D/g, "");
}

// Hungarian cégjegyzékszám (company registration number): court(2) + form(2) +
// serial(6) = 10 digits, however it's punctuated ("01-09-111111").
export function isValidRegNumber(raw: string | null | undefined): boolean {
  return digitsOnly(raw).length === 10;
}

// Hungarian VAT number is 8 digits (+ optional 3-digit suffix). Validate the
// 8-digit core's check digit (weights 9,7,3,1,9,7,3).
export function isValidHuVat(raw: string | null | undefined): boolean {
  const d = digitsOnly(raw);
  if (d.length !== 8 && d.length !== 11) return false;
  const core = d.slice(0, 8);
  const weights = [9, 7, 3, 1, 9, 7, 3];
  let sum = 0;
  for (let i = 0; i < 7; i++) sum += Number(core[i]) * weights[i];
  const check = (10 - (sum % 10)) % 10;
  return check === Number(core[7]);
}
