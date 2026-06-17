// Shared, dependency-free HTML text helpers (pure).

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

export function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, e) => NAMED_ENTITIES[e] ?? `&${e};`);
}

// Strip tags → collapsed, entity-decoded plain text.
export function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

// Extract the strongest "what this business does" signal from a page: the
// <title>, meta description/keywords, og:description and headings say it most
// concisely; fall back to the stripped body when the head is sparse. Bounded so
// the text we persist (classificationText) for re-categorization stays small.
// Pure (no I/O).
export function extractCategoryText(html: string, maxLen = 600): string {
  const grab = (re: RegExp): string[] => {
    const out: string[] = [];
    for (const m of html.matchAll(re)) out.push(m[1] ?? "");
    return out;
  };
  const parts = [
    ...grab(/<title[^>]*>([\s\S]*?)<\/title>/gi),
    // meta description/keywords — attribute order varies (name…content or content…name).
    ...grab(/<meta[^>]+(?:name|property)=["'](?:description|keywords|og:description)["'][^>]+content=["']([^"']*)["']/gi),
    ...grab(/<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["'](?:description|keywords|og:description)["']/gi),
    ...grab(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi),
  ];
  const headText = stripTags(parts.join(" "));
  // Sparse head → consider the body, but only if it actually yields more text
  // (a page that is *only* meta tags has empty body text — don't lose the head).
  let text = headText;
  if (headText.length < 60) {
    const bodyText = stripTags(html);
    if (bodyText.length > headText.length) text = bodyText;
  }
  return text.slice(0, maxLen).trim();
}
