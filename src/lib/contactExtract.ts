// Pure extraction of business contact details from a page's HTML (no I/O).
// Used by the Tier-2 contact-page enrichment to fill missing email/phone for
// leads that have a website. Emails and Hungarian phone numbers are normalized
// and de-duplicated; order of first appearance is preserved.

import { stripTags } from "./html.js";
import { normalizeEmail, normalizePhone } from "./normalize.js";

export type Contacts = { emails: string[]; phones: string[] };

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
// A loose HU phone candidate (+36/06 followed by enough digits); normalizePhone
// validates and canonicalizes it to E.164.
const PHONE_RE = /(?:\+?36|06)[\s\-/().]*\d[\d\s\-/().]{5,}/g;

export function extractContacts(html: string): Contacts {
  const text = stripTags(html);

  const emails: string[] = [];
  const seenEmail = new Set<string>();
  for (const m of text.matchAll(EMAIL_RE)) {
    const e = normalizeEmail(m[0]);
    if (e && !seenEmail.has(e)) {
      seenEmail.add(e);
      emails.push(e);
    }
  }

  const phones: string[] = [];
  const seenPhone = new Set<string>();
  for (const m of text.matchAll(PHONE_RE)) {
    const p = normalizePhone(m[0]);
    if (p && !seenPhone.has(p)) {
      seenPhone.add(p);
      phones.push(p);
    }
  }

  return { emails, phones };
}
