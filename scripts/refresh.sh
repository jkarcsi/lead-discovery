#!/usr/bin/env bash
#
# Production collection cycle for lead-discovery, meant to run on a schedule
# (cron / systemd timer / WSL). One entry point, a few sub-tasks:
#
#   scripts/refresh.sh full      collect all sources + enrich, then report + export   (default)
#   scripts/refresh.sh enrich    only re-scan websites for leads still missing contacts
#   scripts/refresh.sh verify    VAT (VIES) + tax-status (NAV) checks
#   scripts/refresh.sh purge     enforce retention (delete expired personal data)
#
# Env overrides: REGION (default all), FETCH_CONCURRENCY (default 12),
#                MIN_QUALITY (export threshold, default 40).
#
set -euo pipefail

TASK="${1:-full}"

# Repo root = parent of this script's dir, so cron can call it by absolute path.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Single-instance lock: a full live run (esp. enrich over thousands of sites) can
# outlast its interval; never let two pile up.
LOCK="${TMPDIR:-/tmp}/lead-discovery-${TASK}.lock"
exec 9>"$LOCK"
if ! flock -n 9; then
  echo "$(date -Is) [$TASK] previous run still active — skipping" >&2
  exit 0
fi

# Append to a dated log; keep stdout+stderr together.
mkdir -p logs exports
LOG="logs/${TASK}-$(date +%F).log"
exec >>"$LOG" 2>&1

REGION="${REGION:-all}"
export FETCH_CONCURRENCY="${FETCH_CONCURRENCY:-12}"
MIN_QUALITY="${MIN_QUALITY:-40}"
cli() { npm run --silent cli -- "$@"; }

echo "================ $(date -Is) [$TASK] start (region=$REGION) ================"

case "$TASK" in
  full)
    # Collect every non-gated source (resuming cursors) + all enrichment steps.
    cli refresh --region "$REGION" --live
    cli report
    cli export --min-quality "$MIN_QUALITY" --out "exports/procura-$(date +%F).ndjson"
    cli purge                       # retention: drop expired personal data
    ;;
  enrich)
    cli enrich --live               # email/phone from websites (resumable)
    cli report
    ;;
  verify)
    cli verify --live               # EU VIES VAT validation
    cli nav --live                  # NAV tax status
    ;;
  purge)
    cli purge
    ;;
  *)
    echo "unknown task '$TASK' (use: full | enrich | verify | purge)" >&2
    exit 2
    ;;
esac

echo "================ $(date -Is) [$TASK] done ================"
