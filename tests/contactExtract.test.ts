import { describe, it, expect } from "vitest";
import { extractContacts } from "../src/lib/contactExtract.js";

describe("extractContacts", () => {
  it("pulls emails and HU phones from HTML, normalized + deduped", () => {
    const html = `
      <p>Email: <a href="mailto:Info@Ceg.HU">Info@Ceg.HU</a></p>
      <p>Más: info@ceg.hu</p>
      <p>Tel: +36 1 234 5678, mobil: 06 30 111 2233</p>`;
    const c = extractContacts(html);
    expect(c.emails).toEqual(["info@ceg.hu"]); // lowercased + deduped
    expect(c.phones).toEqual(["+3612345678", "+36301112233"]);
  });

  it("returns empty lists when there is nothing to find", () => {
    expect(extractContacts("<p>no contacts here</p>")).toEqual({ emails: [], phones: [] });
  });

  it("ignores malformed emails", () => {
    expect(extractContacts("write to a@@b or c@d").emails).toEqual([]);
  });
});
