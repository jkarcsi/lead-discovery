// Pure parse of a Google Places "place" result into the contact fields we use
// (no I/O). The live lookup + offline fixture live in `connectors/places.ts`.

export type Place = { phone: string | null; website: string | null; address: string | null };

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export function parsePlace(json: unknown): Place {
  const o = (json ?? {}) as Record<string, unknown>;
  return {
    // accept a couple of common Places field spellings
    phone: str(o.phone) ?? str(o.formatted_phone_number) ?? str(o.internationalPhoneNumber),
    website: str(o.website) ?? str(o.websiteUri),
    address: str(o.address) ?? str(o.formatted_address) ?? str(o.formattedAddress),
  };
}
