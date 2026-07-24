export function rateLimiter(perMin) {
  const buckets = new Map();
  return {
    allow(key) {
      const now = Date.now();
      const b = buckets.get(key) || { tokens: perMin, ts: now };
      const refill = ((now - b.ts) / 60000) * perMin;
      b.tokens = Math.min(perMin, b.tokens + refill);
      b.ts = now;
      if (b.tokens < 1) { buckets.set(key, b); return false; }
      b.tokens -= 1; buckets.set(key, b); return true;
    },
  };
}
