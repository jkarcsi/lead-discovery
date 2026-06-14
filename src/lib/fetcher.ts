// HTTP client tuned for throughput and resilience. Three things keep a crawl
// fast in practice: (1) a tunable per-host gap so rate-limiters don't ban us
// mid-run, (2) retries with exponential backoff so a transient 5xx/network blip
// doesn't drop a record, and (3) an in-run response cache so we never fetch the
// same URL twice. robots.txt is honored only when the operator opts in
// (config.respectRobots) — usage legality is handled outside this project.

import robotsParser from "robots-parser";
import { config } from "../config.js";

const lastRequestAt = new Map<string, number>();
const robotsCache = new Map<string, ReturnType<typeof robotsParser> | null>();
const responseCache = new Map<string, string>();

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// Block until at least `minRequestIntervalMs` has passed since the last request
// to this host (0 disables throttling for sources that allow it).
async function throttle(host: string): Promise<void> {
  if (config.minRequestIntervalMs <= 0) return;
  const last = lastRequestAt.get(host) ?? 0;
  const wait = config.minRequestIntervalMs - (Date.now() - last);
  if (wait > 0) await sleep(wait);
  lastRequestAt.set(host, Date.now());
}

function headers(): Record<string, string> {
  const ua = config.contactUrl ? `${config.userAgent} (+${config.contactUrl})` : config.userAgent;
  return { "User-Agent": ua };
}

async function loadRobots(host: string): Promise<ReturnType<typeof robotsParser> | null> {
  if (robotsCache.has(host)) return robotsCache.get(host) ?? null;
  let parsed: ReturnType<typeof robotsParser> | null = null;
  try {
    const url = `https://${host}/robots.txt`;
    const res = await fetch(url, { headers: headers() });
    if (res.ok) parsed = robotsParser(url, await res.text());
  } catch {
    parsed = null;
  }
  robotsCache.set(host, parsed);
  return parsed;
}

export async function isAllowedByRobots(url: string): Promise<boolean> {
  const host = hostOf(url);
  const robots = await loadRobots(host);
  if (!robots) return true;
  return robots.isAllowed(url, config.userAgent) ?? true;
}

// Retryable transport: throttles, fetches, and retries transient failures
// (network errors + 429/5xx) with exponential backoff. Returns the body text.
async function request(
  method: "GET" | "POST",
  url: string,
  init: { body?: string; contentType?: string } = {},
): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= config.fetchMaxRetries; attempt++) {
    if (attempt > 0) await sleep(config.fetchBackoffBaseMs * 2 ** (attempt - 1));
    await throttle(hostOf(url));
    try {
      const res = await fetch(url, {
        method,
        headers: {
          ...headers(),
          ...(init.contentType ? { "Content-Type": init.contentType } : {}),
        },
        ...(init.body !== undefined ? { body: init.body } : {}),
      });
      // 429/5xx are worth retrying; other non-OK statuses are terminal.
      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`${method} ${url} → ${res.status}`);
        continue;
      }
      if (!res.ok) throw new Error(`${method} ${url} → ${res.status}`);
      return res.text();
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(`${method} ${url} failed`);
}

function cacheKey(method: string, url: string, body?: string): string {
  return body !== undefined ? `${method} ${url}\n${body}` : `${method} ${url}`;
}

// Rate-limited, retried, cached GET. robots.txt is checked only when the
// operator has opted in globally (config.respectRobots).
export async function politeGet(url: string, opts: { checkRobots?: boolean } = {}): Promise<string> {
  if ((opts.checkRobots ?? config.respectRobots) && !(await isAllowedByRobots(url))) {
    throw new Error(`robots.txt disallows ${url}`);
  }
  const key = cacheKey("GET", url);
  if (config.fetchCacheEnabled && responseCache.has(key)) return responseCache.get(key)!;
  const body = await request("GET", url);
  if (config.fetchCacheEnabled) responseCache.set(key, body);
  return body;
}

// Rate-limited, retried, cached POST (Overpass takes the query in the body).
export async function politePost(url: string, body: string): Promise<string> {
  const key = cacheKey("POST", url, body);
  if (config.fetchCacheEnabled && responseCache.has(key)) return responseCache.get(key)!;
  const out = await request("POST", url, { body, contentType: "text/plain" });
  if (config.fetchCacheEnabled) responseCache.set(key, out);
  return out;
}

// Rate-limited, retried, cached JSON POST (VIES REST).
export async function politePostJson(url: string, payload: unknown): Promise<string> {
  const body = JSON.stringify(payload);
  const key = cacheKey("POSTJSON", url, body);
  if (config.fetchCacheEnabled && responseCache.has(key)) return responseCache.get(key)!;
  const out = await request("POST", url, { body, contentType: "application/json" });
  if (config.fetchCacheEnabled) responseCache.set(key, out);
  return out;
}

// Drop the in-run response cache (e.g. between independent CLI operations/tests).
export function clearFetchCache(): void {
  responseCache.clear();
}
