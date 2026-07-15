/**
 * ユーザー単位の簡易rate limit。
 * serverless instanceごとのin-memory sliding windowであり、完全な
 * グローバル制限ではないが、単一instanceへの連続入力を抑える。
 * DB側のsession・version・idempotency制約が最終的な安全装置である。
 */

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 20;
const MAX_TRACKED_USERS = 10_000;

const buckets = new Map<string, number[]>();

export function isRateLimited(
  userId: string,
  now: number = Date.now(),
): boolean {
  const windowStart = now - WINDOW_MS;
  const timestamps = (buckets.get(userId) ?? []).filter(
    (timestamp) => timestamp > windowStart,
  );
  if (timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    buckets.set(userId, timestamps);
    return true;
  }
  timestamps.push(now);
  if (!buckets.has(userId) && buckets.size >= MAX_TRACKED_USERS) {
    buckets.clear();
  }
  buckets.set(userId, timestamps);
  return false;
}

export function resetRateLimiter(): void {
  buckets.clear();
}
