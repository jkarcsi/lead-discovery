// Connector registry. Add new sources here; each one widens coverage, and
// overlapping businesses merge across sources on the dedupe key.

import type { Connector } from "./types.js";
import { overpassConnector } from "./overpass.js";
import { directoryConnector } from "./directory.js";
import { htmlDirectoryConnector } from "./htmlDirectory.js";
import { ebeszamoloConnector } from "./ebeszamolo.js";
import { kozbeszerzesConnector } from "./kozbeszerzes.js";
import { mkikConnector } from "./mkik.js";

const REGISTRY: Record<string, Connector> = {
  [overpassConnector.id]: overpassConnector,
  [directoryConnector.id]: directoryConnector,
  [htmlDirectoryConnector.id]: htmlDirectoryConnector,
  [ebeszamoloConnector.id]: ebeszamoloConnector,
  [kozbeszerzesConnector.id]: kozbeszerzesConnector,
  [mkikConnector.id]: mkikConnector,
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
