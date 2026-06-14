import { describe, it, expect } from "vitest";
import { parsePlace } from "../src/lib/placesParse.js";

describe("parsePlace", () => {
  it("reads common Places field spellings", () => {
    expect(parsePlace({ formatted_phone_number: "+36 1 700 8080", website: "https://x.hu", formatted_address: "1138 Budapest" })).toEqual({
      phone: "+36 1 700 8080",
      website: "https://x.hu",
      address: "1138 Budapest",
    });
    expect(parsePlace({ internationalPhoneNumber: "+36 1 222", websiteUri: "https://y.hu", formattedAddress: "Bp" })).toEqual({
      phone: "+36 1 222",
      website: "https://y.hu",
      address: "Bp",
    });
  });

  it("returns nulls for missing/blank fields", () => {
    expect(parsePlace({})).toEqual({ phone: null, website: null, address: null });
    expect(parsePlace({ phone: "   " }).phone).toBeNull();
    expect(parsePlace(null)).toEqual({ phone: null, website: null, address: null });
  });
});
