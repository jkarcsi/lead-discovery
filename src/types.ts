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
  source: string;
  sourceUrl?: string | null;
  sourceLicense?: string | null;
};

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
  source: string;
  sourceUrl?: string | null;
  sourceLicense?: string | null;
  isPersonalData: boolean;
};
