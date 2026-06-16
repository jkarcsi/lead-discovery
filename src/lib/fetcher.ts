// HTTP client tuned for throughput and resilience. Three things keep a crawl
// fast in practice: (1) a tunable per-host gap so rate-limiters don't ban us
// mid-run, (2) retries with exponential backoff so a transient 5xx/network blip
// doesn't drop a record, and (3) an in-run response cache so we never fetch the
// same URL twice. robots.txt is honored only when the operator opts in
// (config.respectRobots) — usage legality is handled outside this project.

import robotsParser from "robots-parser";
import { config } from "../config.js";

// Per-host "next free slot" timestamp. We reserve a slot *synchronously* (before
// any await), so N concurrent requests to one host are spaced minRequestIntervalMs
// apart instead of all reading the same stale time and firing together.
const nextSlotAt = new Map<string, number>();
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

// Reserved TLDs (RFC 2606/6761) used as endpoint placeholders in config. A live
// crawl against one can only "fetch fail", so we catch it early with a message
// that says what to configure instead of a bare network error.
const PLACEHOLDER_TLDS = [".test", ".invalid", ".example", ".localhost"];

export function isPlaceholderEndpoint(url: string): boolean {
  const host = hostOf(url);
  return PLACEHOLDER_TLDS.some((tld) => host.endsWith(tld));
}

// Guard a live fetch: a placeholder endpoint means no real source is wired yet.
export function assertLiveEndpoint(url: string, source: string, envVar: string): void {
  if (isPlaceholderEndpoint(url)) {
    throw new Error(
      `source "${source}" has no live endpoint configured (${url} is a placeholder) — ` +
        `set ${envVar} in .env to a real listing URL, or run without --live to use fixtures`,
    );
  }
}

// Reserve this host's next request slot and block until it's due. Reserving the
// slot synchronously (advancing nextSlotAt before the await) is what makes the
// gap hold under concurrency: each caller claims a distinct, later slot rather
// than every concurrent caller reading the same timestamp and firing at once.
// 0 disables throttling for sources that allow it.
async function throttle(host: string): Promise<void> {
  if (config.minRequestIntervalMs <= 0) return;
  const now = Date.now();
  const slot = Math.max(now, nextSlotAt.get(host) ?? 0);
  nextSlotAt.set(host, slot + config.minRequestIntervalMs);
  const wait = slot - now;
  if (wait > 0) await sleep(wait);
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

// Per-call transport overrides. Curated APIs want the resilient defaults;
// scraping arbitrary websites (enrich) wants to be impatient — few/no retries
// and a shorter timeout — so one slow site doesn't cost retries × timeout.
export type RequestOptions = { retries?: number; timeoutMs?: number };

// Retryable transport: throttles, fetches, and retries transient failures
// (network errors + 429/5xx) with exponential backoff. Returns the body text.
async function request(
  method: "GET" | "POST",
  url: string,
  init: { body?: string; contentType?: string } & RequestOptions = {},
): Promise<string> {
  const maxRetries = init.retries ?? config.fetchMaxRetries;
  const timeoutMs = init.timeoutMs ?? config.fetchTimeoutMs;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) await sleep(config.fetchBackoffBaseMs * 2 ** (attempt - 1));
    await throttle(hostOf(url));
    // Abort a request that exceeds the timeout so one slow host can't stall the
    // run; the abort surfaces as a thrown error and is retried like any blip.
    const controller = timeoutMs > 0 ? new AbortController() : undefined;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : undefined;
    try {
      const res = await fetch(url, {
        method,
        headers: {
          ...headers(),
          ...(init.contentType ? { "Content-Type": init.contentType } : {}),
        },
        ...(init.body !== undefined ? { body: init.body } : {}),
        ...(controller ? { signal: controller.signal } : {}),
      });
      // 429/5xx are worth retrying; other non-OK statuses are terminal.
      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`${method} ${url} → ${res.status}`);
        // Respect an explicit Retry-After (seconds) before the next attempt;
        // rate-limiters like Overpass use it to tell us exactly how long to wait.
        const retryAfter = Number(res.headers.get("retry-after"));
        if (Number.isFinite(retryAfter) && retryAfter > 0) await sleep(retryAfter * 1000);
        continue;
      }
      if (!res.ok) throw new Error(`${method} ${url} → ${res.status}`);
      return await res.text();
    } catch (err) {
      lastErr = err;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(`${method} ${url} failed`);
}

function cacheKey(method: string, url: string, body?: string): string {
  return body !== undefined ? `${method} ${url}\n${body}` : `${method} ${url}`;
}

// Rate-limited, retried, cached GET. robots.txt is checked only when the
// operator has opted in globally (config.respectRobots).
export async function politeGet(
  url: string,
  opts: { checkRobots?: boolean } & RequestOptions = {},
): Promise<string> {
  if ((opts.checkRobots ?? config.respectRobots) && !(await isAllowedByRobots(url))) {
    throw new Error(`robots.txt disallows ${url}`);
  }
  const key = cacheKey("GET", url);
  if (config.fetchCacheEnabled && responseCache.has(key)) return responseCache.get(key)!;
  const body = await request("GET", url, { retries: opts.retries, timeoutMs: opts.timeoutMs });
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
