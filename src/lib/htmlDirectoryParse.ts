// Dependency-free parser for an HTML business-listing page. It expects each
// business in a "card" element carrying class `biz` with `data-id`, and fields
// tagged by class: `name`, `cat`, `email` (mailto link), `phone`, `web` (link),
// `addr`. Pure (no I/O). This is the deliberately-simple, no-dependency approach
// — tuned to a known directory's markup, not a general HTML engine.

import type { ParseContext, RawBusiness } from "../types.js";

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, e) => NAMED_ENTITIES[e] ?? `&${e};`);
}

function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

// Inner text of the first element carrying class `cls` within a card.
function fieldText(card: string, cls: string): string | null {
  const re = new RegExp(`<[^>]*class="[^"]*\\b${cls}\\b[^"]*"[^>]*>([\\s\\S]*?)<`, "i");
  const m = card.match(re);
  return m ? stripTags(m[1]) || null : null;
}

// href of the first <a class="cls"> within a card.
function hrefOf(card: string, cls: string): string | null {
  const re = new RegExp(`<a[^>]*class="[^"]*\\b${cls}\\b[^"]*"[^>]*href="([^"]*)"`, "i");
  const m = card.match(re);
  return m ? m[1] : null;
}

export function parseHtmlDirectory(html: string, ctx: ParseContext): RawBusiness[] {
  const out: RawBusiness[] = [];
  const cardRe = /<(li|div|article)\b[^>]*\bclass="[^"]*\bbiz\b[^"]*"[^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;

  while ((m = cardRe.exec(html)) !== null) {
    const openTag = m[0].slice(0, m[0].indexOf(">") + 1);
    const card = m[2];

    const name = fieldText(card, "name");
    if (!name) continue;

    const idMatch = openTag.match(/data-id="([^"]*)"/i);
    const cat = fieldText(card, "cat") ?? "";
    const emailHref = hrefOf(card, "email");
    const email = emailHref ? emailHref.replace(/^mailto:/i, "") : fieldText(card, "email");
    const website = hrefOf(card, "web") ?? fieldText(card, "web");

    out.push({
      legalName: name,
      brandName: null,
      email: email || null,
      phone: fieldText(card, "phone") || null,
      website: website || null,
      address: fieldText(card, "addr") || null,
      vatNumber: null,
      registrationNumber: null,
      classificationText: `${cat} ${name}`.trim(),
      source: ctx.source,
      sourceUrl: idMatch ? `${ctx.baseUrl}/biz/${idMatch[1]}` : ctx.baseUrl,
      sourceLicense: ctx.license,
    });
  }
  return out;
}
