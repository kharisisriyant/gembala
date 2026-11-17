export type RetryableError = Error & { retryAfterMs?: number }

const BASE_MS = 5_000
const MAX_MS = 10 * 60_000

// Exponential backoff with jitter; a provider's retry_after overrides it (RL-3).
export function backoffDelay(attemptsMade: number, retryAfterMs?: number, random = Math.random): number {
  if (retryAfterMs && retryAfterMs > 0) return retryAfterMs
  const exp = Math.min(MAX_MS, BASE_MS * 2 ** Math.max(0, attemptsMade - 1))
  return Math.round(exp * (0.8 + random() * 0.4))
}
