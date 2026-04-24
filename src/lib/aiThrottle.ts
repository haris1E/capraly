/**
 * Client-side throttling for AI gateway calls.
 *
 * Why: hammering the edge functions provokes 429/402 quickly and burns
 * credits. We enforce a minimum gap between successive calls per endpoint,
 * and on a 429/402 response we apply exponential backoff (capped) so the
 * UI can show a live countdown before the user can retry.
 *
 * Usage:
 *   const guard = aiThrottle.check("bug-finder");
 *   if (!guard.ok) return; // panel already shows countdown
 *   aiThrottle.markStart("bug-finder");
 *   ... call edge function ...
 *   aiThrottle.markFailure("bug-finder", status); // on 429/402
 *   aiThrottle.markSuccess("bug-finder");          // resets backoff
 */
import { useSyncExternalStore } from "react";
import { aiErrors } from "./aiErrorStore";

type Endpoint = "bug-finder" | "code-chat";

interface Bucket {
  lastCallAt: number;     // ms — when we last *started* a call
  blockedUntil: number;   // ms — wall-clock until which calls are blocked
  consecutiveBlocks: number; // for exponential backoff
}

const MIN_GAP_MS: Record<Endpoint, number> = {
  "bug-finder": 4_000,    // expensive — don't allow rapid rescans
  "code-chat":  1_500,    // chatty — allow tighter cadence
};

const buckets: Record<Endpoint, Bucket> = {
  "bug-finder": { lastCallAt: 0, blockedUntil: 0, consecutiveBlocks: 0 },
  "code-chat":  { lastCallAt: 0, blockedUntil: 0, consecutiveBlocks: 0 },
};

const listeners = new Set<() => void>();
function emit() { listeners.forEach((l) => l()); }

// Tick every 250ms while ANY bucket is blocked so countdowns animate smoothly.
let tickHandle: number | null = null;
function ensureTicker() {
  if (tickHandle != null) return;
  tickHandle = window.setInterval(() => {
    const now = Date.now();
    const anyBlocked = Object.values(buckets).some((b) => b.blockedUntil > now);
    emit();
    if (!anyBlocked && tickHandle != null) {
      window.clearInterval(tickHandle);
      tickHandle = null;
    }
  }, 250);
}

function backoffFor(status: number | undefined, blocks: number): number {
  // 402 = credits exhausted → block longer (90s) to discourage retry hammering.
  if (status === 402) return 90_000;
  // 429 = rate-limited → 8s, 16s, 32s, capped at 60s.
  const base = status === 429 ? 8_000 : 4_000;
  return Math.min(base * 2 ** Math.max(0, blocks - 1), 60_000);
}

export const aiThrottle = {
  /** Returns { ok, retryAfterMs } — caller bails out if !ok. */
  check(endpoint: Endpoint): { ok: true } | { ok: false; retryAfterMs: number; reason: "cooldown" | "blocked" } {
    const now = Date.now();
    const b = buckets[endpoint];

    if (b.blockedUntil > now) {
      ensureTicker();
      return { ok: false, retryAfterMs: b.blockedUntil - now, reason: "blocked" };
    }
    const gap = now - b.lastCallAt;
    if (gap < MIN_GAP_MS[endpoint]) {
      const wait = MIN_GAP_MS[endpoint] - gap;
      return { ok: false, retryAfterMs: wait, reason: "cooldown" };
    }
    return { ok: true };
  },

  markStart(endpoint: Endpoint) {
    buckets[endpoint].lastCallAt = Date.now();
    emit();
  },

  markSuccess(endpoint: Endpoint) {
    buckets[endpoint].consecutiveBlocks = 0;
    buckets[endpoint].blockedUntil = 0;
    emit();
  },

  /** Call after a 429/402 response — sets a backoff window + surfaces it. */
  markFailure(endpoint: Endpoint, status: number | undefined) {
    if (status !== 429 && status !== 402) return;
    const b = buckets[endpoint];
    b.consecutiveBlocks += 1;
    const wait = backoffFor(status, b.consecutiveBlocks);
    b.blockedUntil = Date.now() + wait;
    aiErrors.setBlockedUntil(b.blockedUntil);
    ensureTicker();
    emit();
  },

  /** Read-only view used by the AiErrorPanel for live countdowns. */
  remainingMs(endpoint: Endpoint): number {
    const b = buckets[endpoint];
    return Math.max(0, b.blockedUntil - Date.now());
  },

  subscribe(l: () => void) {
    listeners.add(l);
    return () => { listeners.delete(l); };
  },
};

/** Reactive hook — re-renders ~every 250ms while any endpoint is blocked. */
export function useThrottleTick(): number {
  return useSyncExternalStore(
    (l) => aiThrottle.subscribe(l),
    () => Date.now(),
    () => Date.now(),
  );
}
