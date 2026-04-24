/**
 * Tiny global event bus for surfacing the most-recent AI gateway error
 * (status, message, request context) into a dedicated panel.
 *
 * Why: 429/402 toasts disappear; users need a stable, inspectable surface
 * with retry guidance. This is a zero-dependency pub/sub with a snapshot
 * useSyncExternalStore-friendly API.
 */
import { useSyncExternalStore } from "react";

export interface AiErrorRecord {
  id: string;
  status?: number;
  message: string;
  endpoint: string;             // e.g. "bug-finder"
  requestSummary: string;       // short description of payload (no secrets)
  rawBody?: string;             // optional raw response text
  timestamp: number;
}

let current: AiErrorRecord | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export const aiErrors = {
  push(rec: Omit<AiErrorRecord, "id" | "timestamp">) {
    current = { ...rec, id: crypto.randomUUID(), timestamp: Date.now() };
    emit();
  },
  clear() {
    current = null;
    emit();
  },
  get() {
    return current;
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export function useAiError(): AiErrorRecord | null {
  return useSyncExternalStore(
    (l) => aiErrors.subscribe(l),
    () => aiErrors.get(),
    () => null,
  );
}

/** Friendly retry guidance keyed on HTTP status. */
export function retryGuidance(status?: number): string {
  switch (status) {
    case 401:
      return "Your session expired. Sign out and back in, then try again.";
    case 402:
      return "AI credits are exhausted. Add funds in Workspace → Usage, then retry.";
    case 429:
      return "You're being rate limited. Wait ~30 seconds and try again, or switch to a lighter model (e.g. Gemini Flash Lite).";
    case 413:
      return "The file is too large for a single scan. Split it into smaller modules and re-run.";
    case 500:
    case 502:
    case 503:
    case 504:
      return "The AI gateway is having a moment. Wait 10–20 seconds and retry. If it persists, switch models.";
    default:
      return "Try again in a moment. If the error persists, check your network and that you're signed in.";
  }
}
