// Raw record as produced by a connector, before normalization.
export type RawBusiness = {
  legalName: string;
  brandName?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
  vatNumber?: string | null;
  registrationNumber?: string | null;
  // Free-text hints (OSM tags, activity descriptions) used for categorization.
  classificationText?: string | null;
  // Authoritative category ids a connector already knows (e.g. CPV-mapped),
  // merged with keyword-derived categories in transform.
  categories?: string[];
  // A source may assert personal data (e.g. the sole-trader registry); OR-ed
  // with the name/email heuristic in transform.
  isPersonalData?: boolean;
  source: string;
  sourceUrl?: string | null;
  sourceLicense?: string | null;
};

// Provenance a page-parser stamps onto each record it produces.
export type ParseContext = { baseUrl: string; license: string; source: string };

// Normalized + categorized lead, ready to upsert.
export type LeadInput = {
  legalName: string;
  brandName?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  domain?: string | null;
  address?: string | null;
  vatNumber?: string | null;
  registrationNumber?: string | null;
  regionId?: string | null;
  categories: string[];
  // Free-text categorization input, retained so the lead can be re-categorized later.
  classificationText?: string | null;
  source: string;
  sourceUrl?: string | null;
  sourceLicense?: string | null;
  isPersonalData: boolean;
};
