import { describe, it, expect } from "vitest";
import { parseEvnyPage } from "../src/lib/evnyParse.js";

const ctx = {
  baseUrl: "https://evny.test/api",
  license: "EVNY (sole-trader registry, personal data)",
  source: "evny",
};

describe("parseEvnyPage", () => {
  it("always flags sole traders as personal data and categorizes from TEÁOR", () => {
    const out = parseEvnyPage(
      {
        results: [
          {
            id: "EV-1",
            name: "Kovács János e.v.",
            registrationNumber: "50012345",
            seat: "1089 Budapest",
            teaorCode: "8121",
            teaorText: "épülettakarítás",
          },
        ],
      },
      ctx,
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      legalName: "Kovács János e.v.",
      isPersonalData: true,
      categories: ["cleaning"],
      source: "evny",
      sourceUrl: "https://evny.test/api/ev/EV-1",
    });
  });

  it("skips nameless records and handles empty input", () => {
    expect(parseEvnyPage({ results: [{ teaorCode: "8121" }] }, ctx)).toEqual([]);
    expect(parseEvnyPage({}, ctx)).toEqual([]);
  });
});
