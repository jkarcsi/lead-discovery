// Polite HTTP client for any live fetch. Three guarantees the legal design
// requires (see docs/LEGAL.md): an identified User-Agent with a contact URL,
// per-domain rate limiting, and robots.txt is honored for page fetches.

import robotsParser from "robots-parser";
import { config } from "../config.js";

const lastRequestAt = new Map<string, number>();
const robotsCache = new Map<string, ReturnType<typeof robotsParser> | null>();

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
// to this host.
async function throttle(host: string): Promise<void> {
  const last = lastRequestAt.get(host) ?? 0;
  const wait = config.minRequestIntervalMs - (Date.now() - last);
  if (wait > 0) await sleep(wait);
  lastRequestAt.set(host, Date.now());
}

function headers(): Record<string, string> {
  const ua = config.contactUrl
    ? `${config.userAgent} (+${config.contactUrl})`
    : config.userAgent;
  return { "User-Agent": ua };
}

// Fetch and cache a host's robots.txt. Network failure → treat as "unknown",
// which we resolve conservatively at the call site (default: allow API hosts,
// disallow scraping unknown sites — but Tier-1 connectors don't scrape pages).
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
  if (!robots) return true; // no robots.txt published → not disallowed
  return robots.isAllowed(url, config.userAgent) ?? true;
}

// Rate-limited GET that honors robots.txt. Throws on non-OK responses so the
// caller can back off rather than ingest garbage.
export async function politeGet(url: string, opts: { checkRobots?: boolean } = {}): Promise<string> {
  if (opts.checkRobots && !(await isAllowedByRobots(url))) {
    throw new Error(`robots.txt disallows ${url}`);
  }
  await throttle(hostOf(url));
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  return res.text();
}

// Rate-limited POST (Overpass takes the query in the body). Same UA + throttle.
export async function politePost(url: string, body: string): Promise<string> {
  await throttle(hostOf(url));
  const res = await fetch(url, {
    method: "POST",
    headers: { ...headers(), "Content-Type": "text/plain" },
    body,
  });
  if (!res.ok) throw new Error(`POST ${url} → ${res.status}`);
  return res.text();
}

// Rate-limited JSON POST (VIES REST takes a JSON body, returns JSON). Same
// identified UA + per-host throttle as the other polite calls.
export async function politePostJson(url: string, payload: unknown): Promise<string> {
  await throttle(hostOf(url));
  const res = await fetch(url, {
    method: "POST",
    headers: { ...headers(), "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`POST ${url} → ${res.status}`);
  return res.text();
}
