// Connector registry. Add new Tier-1 sources (company registry, chamber data)
// here as they pass legal review.

import type { Connector } from "./types.js";
import { overpassConnector } from "./overpass.js";

const REGISTRY: Record<string, Connector> = {
  [overpassConnector.id]: overpassConnector,
};

export function getConnector(id: string): Connector {
  const c = REGISTRY[id];
  if (!c) {
    throw new Error(
      `Unknown connector "${id}". Available: ${Object.keys(REGISTRY).join(", ")}`,
    );
  }
  return c;
}

export function listConnectors(): string[] {
  return Object.keys(REGISTRY);
}

// Source id + data licence for each registered connector — provenance input for
// the Art. 30 record (see lib/ropa.ts).
export function connectorSources(): { id: string; license: string }[] {
  return Object.values(REGISTRY).map((c) => ({ id: c.id, license: c.license }));
}
