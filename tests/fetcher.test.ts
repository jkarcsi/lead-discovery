// Coverage for the side-effecting fetcher's throughput/resilience behaviour:
// (1) the per-host throttle must hold *under concurrency* — the original bug was
// that N concurrent requests all read the same stale timestamp and fired at once
// (the cause of the Overpass 429/504 floods); (2) a live fetch against a reserved
// placeholder TLD must fail fast with an actionable message, not a bare network
// error. The throttle interval is set before importing config (which reads env at
// module-eval), so these tests stay fast and deterministic.

process.env.MIN_REQUEST_INTERVAL_MS = "60";

import http from "node:http";
import { describe, it, expect } from "vitest";

async function withServer(
  onRequest: () => void,
  run: (base: string) => Promise<void>,
): Promise<void> {
  const server = http.createServer((_req, res) => {
    onRequest();
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ok");
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  const port = (server.address() as { port: number }).port;
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
  }
}

describe("politeGet throttle", () => {
  it("serializes concurrent same-host requests by the per-host interval", async () => {
    const { politeGet, clearFetchCache } = await import("../src/lib/fetcher.js");
    let count = 0;
    let elapsed = 0;
    await withServer(
      () => count++,
      async (base) => {
        clearFetchCache();
        const start = Date.now();
        // Distinct URLs (so the in-run cache doesn't collapse them), same host.
        await Promise.all(Array.from({ length: 5 }, (_, i) => politeGet(`${base}/p${i}`)));
        elapsed = Date.now() - start;
      },
    );
    expect(count).toBe(5);
    // The anti-clumping signal: 5 requests serialized at 60ms must take >= ~4
    // intervals of wall time (the throttle's reserved sleeps). With the original
    // bug they fired together and the batch finished almost instantly. Client-side
    // elapsed reflects the throttle directly, free of per-connection arrival jitter.
    expect(elapsed).toBeGreaterThanOrEqual(4 * 60 - 20);
  });
});

describe("assertLiveEndpoint", () => {
  it("rejects reserved placeholder TLDs with a configurable message", async () => {
    const { assertLiveEndpoint, isPlaceholderEndpoint } = await import("../src/lib/fetcher.js");
    expect(isPlaceholderEndpoint("https://example-directory.test/api")).toBe(true);
    expect(() => assertLiveEndpoint("https://example-directory.test/api", "directory", "DIRECTORY_URL")).toThrow(
      /DIRECTORY_URL/,
    );
  });

  it("passes real endpoints through", async () => {
    const { assertLiveEndpoint, isPlaceholderEndpoint } = await import("../src/lib/fetcher.js");
    expect(isPlaceholderEndpoint("https://overpass-api.de/api/interpreter")).toBe(false);
    expect(() => assertLiveEndpoint("https://overpass-api.de/api/interpreter", "overpass", "OVERPASS_URL")).not.toThrow();
  });
});
