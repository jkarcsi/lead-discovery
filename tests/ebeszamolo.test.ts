// The company registry (Céginformációs Szolgálat) forbids automated/bulk access
// to the free e-cegjegyzek.hu lookup without a usage agreement (and gates it with
// a CAPTCHA). The connector must therefore refuse live collection until the
// operator confirms a licence — and never attempt to scrape the free site.

import { describe, it, expect } from "vitest";
import { ebeszamoloConnector } from "../src/connectors/ebeszamolo.js";

describe("ebeszamolo licence gate", () => {
  it("blocks LIVE collection when no usage-agreement flag is set", async () => {
    // EBESZAMOLO_LICENSED is unset in the test env → must throw before any fetch.
    await expect(
      ebeszamoloConnector.collect({ regionId: "budapest", live: true }),
    ).rejects.toThrow(/usage agreement|licen|e-cegjegyzek/i);
  });

  it("still collects offline from fixtures (no licence needed)", async () => {
    const res = await ebeszamoloConnector.collect({ regionId: "budapest", live: false });
    expect(res.records.length).toBeGreaterThan(0);
  });
});
